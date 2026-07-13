import Link from 'next/link';

export default function TermsPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@fzmanager.app';

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-5 py-8">
      <article className="mx-auto max-w-3xl rounded-lg border border-[var(--line)] bg-white p-6">
        <p className="text-sm font-semibold text-[var(--accent)]">Derniere mise a jour: 7 juillet 2026</p>
        <h1 className="mt-3 text-3xl font-semibold">Conditions d utilisation</h1>
        <div className="mt-6 grid gap-6 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Service</h2>
            <p className="mt-2">Loyelio fournit un espace de suivi locatif, documentaire et fiscal indicatif pour petits bailleurs. Le service ne remplace pas un expert-comptable, un avocat ou un conseiller fiscal.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Compte</h2>
            <p className="mt-2">Vous etes responsable de l exactitude des informations saisies et de la confidentialite de votre compte. Vous devez disposer des droits necessaires pour stocker les documents ajoutes.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Facturation</h2>
            <p className="mt-2">Les abonnements et paiements sont geres par Stripe. Les acces payants sont actives apres confirmation du paiement par Stripe et peuvent etre suspendus en cas d echec ou d annulation.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Disponibilite</h2>
            <p className="mt-2">Nous faisons des efforts raisonnables pour maintenir le service disponible, sans garantie d absence totale d interruption, d erreur ou de perte de donnees.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Contact</h2>
            <p className="mt-2">
              Pour toute question sur le service, contactez <a className="font-semibold text-[var(--accent)]" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
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
