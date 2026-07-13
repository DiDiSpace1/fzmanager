import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Stripe from 'stripe';
import {createClient} from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));

const appUrl = (process.env.SMOKE_TEST_APP_URL || process.env.NEXT_PUBLIC_PRODUCTION_APP_URL || 'https://loyelio.vercel.app').replace(/\/$/, '');
const checks = [];

function record(name, ok, details = '') {
  checks.push({details, name, ok});
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status} ${name}${details ? ` - ${details}` : ''}`);
}

async function checkFetch(name, url, expectedStatuses, options = {}) {
  try {
    const response = await fetch(url, {
      redirect: options.redirect ?? 'manual',
      ...options
    });
    const ok = expectedStatuses.includes(response.status);
    record(name, ok, `${response.status}${response.headers.get('location') ? ` -> ${response.headers.get('location')}` : ''}`);
    return response;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function checkPublicRoutes() {
  await checkFetch('home page', `${appUrl}/`, [200]);
  await checkFetch('login page', `${appUrl}/login`, [200]);
  await checkFetch('privacy page', `${appUrl}/privacy`, [200]);
  await checkFetch('terms page', `${appUrl}/terms`, [200]);
  await checkFetch('robots.txt', `${appUrl}/robots.txt`, [200]);
  await checkFetch('sitemap.xml', `${appUrl}/sitemap.xml`, [200]);
  await checkFetch('protected dashboard does not error', `${appUrl}/dashboard`, [200, 307, 308]);
  await checkFetch('protected zh tax does not error', `${appUrl}/zh/tax`, [200, 307, 308]);
  await checkFetch('missing page returns 404', `${appUrl}/zh/not-a-real-page`, [404]);
  await checkFetch('unsigned Stripe webhook rejected', `${appUrl}/api/stripe/webhook`, [400], {method: 'POST'});
}

async function checkStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    record('Stripe secret key configured', false, 'missing STRIPE_SECRET_KEY');
    return;
  }

  record('Stripe mode', true, secretKey.startsWith('sk_test_') ? 'test' : secretKey.startsWith('sk_live_') ? 'live' : 'unknown');

  const stripe = new Stripe(secretKey);
  const prices = [
    ['solo price', process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO, 'recurring'],
    ['plus price', process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS, 'recurring'],
    ['portfolio price', process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO, 'recurring']
  ];

  for (const [name, priceId, expectedType] of prices) {
    if (!priceId) {
      record(name, false, 'missing price id');
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId);
      record(name, price.active && price.type === expectedType, `active=${price.active}, type=${price.type}, interval=${price.recurring?.interval ?? 'none'}`);
    } catch (error) {
      record(name, false, error instanceof Error ? error.message : String(error));
    }
  }

  const endpoints = await stripe.webhookEndpoints.list({limit: 10});
  const webhook = endpoints.data.find((endpoint) => endpoint.url === `${appUrl}/api/stripe/webhook`);
  record('Stripe webhook endpoint URL', Boolean(webhook), webhook ? webhook.status : 'missing /api/stripe/webhook endpoint');

  if (webhook) {
    const requiredEvents = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];
    const missingEvents = requiredEvents.filter((event) => !webhook.enabled_events.includes(event) && !webhook.enabled_events.includes('*'));
    record('Stripe webhook events', missingEvents.length === 0, missingEvents.length ? `missing ${missingEvents.join(', ')}` : 'all required events enabled');
  }
}

async function checkSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    record('Supabase admin configured', false, 'missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const tables = ['profiles', 'workspaces', 'properties', 'tenants', 'documents', 'expenses', 'tax_exports', 'workspace_billing'];

  for (const table of tables) {
    const {error} = await supabase.from(table).select('*', {count: 'exact', head: true});
    record(`Supabase table ${table}`, !error, error?.message ?? 'reachable');
  }

  const {data: buckets, error: bucketError} = await supabase.storage.listBuckets();
  const hasDocumentsBucket = Boolean(buckets?.some((bucket) => bucket.name === 'documents'));
  record('Supabase documents bucket', !bucketError && hasDocumentsBucket, bucketError?.message ?? (hasDocumentsBucket ? 'present' : 'missing'));
}

async function main() {
  console.log(`Smoke test target: ${appUrl}`);
  await checkPublicRoutes();
  await checkStripe();
  await checkSupabase();

  if (!process.env.NEXT_PUBLIC_SUPPORT_EMAIL) {
    record('support email configured locally', true, 'not set locally; verify it in Vercel');
  } else {
    record('support email configured locally', true, process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  }

  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
