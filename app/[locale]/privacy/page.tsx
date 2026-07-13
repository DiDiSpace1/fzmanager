import Link from 'next/link';

export default function PrivacyPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@fzmanager.app';

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-5 py-8">
      <article className="mx-auto max-w-3xl rounded-lg border border-[var(--line)] bg-white p-6">
        <p className="text-sm font-semibold text-[var(--accent)]">Derniere mise a jour: 7 juillet 2026</p>
        <h1 className="mt-3 text-3xl font-semibold">Politique de confidentialite</h1>
        <div className="mt-6 grid gap-6 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Donnees collectees</h2>
            <p className="mt-2">Loyelio collecte les informations de compte, les biens, locataires, baux, loyers, depenses et documents que vous ajoutez volontairement dans votre espace.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Utilisation</h2>
            <p className="mt-2">Ces donnees servent a fournir le service, securiser votre compte, generer vos exports et ameliorer l experience produit. Les paiements sont traites par Stripe.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Sous-traitants</h2>
            <p className="mt-2">Le service s appuie sur Supabase pour l authentification, la base de donnees et le stockage, Stripe pour la facturation, et Vercel pour l hebergement.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Vos droits</h2>
            <p className="mt-2">Vous pouvez demander l acces, la correction ou la suppression de vos donnees. Les obligations comptables ou legales peuvent imposer une conservation limitee de certaines informations.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Contact</h2>
            <p className="mt-2">
              Pour toute demande liee aux donnees personnelles, contactez <a className="font-semibold text-[var(--accent)]" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
            </p>
          </section>
        </div>
        <Link className="focus-ring mt-8 inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f2f0ea]" href="/">
          Retour
        </Link>
      </article>
    </main>
  );
}
