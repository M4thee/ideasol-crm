import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Polityka prywatności aplikacji IdeaSol CRM",
  description:
    "Informacje o przetwarzaniu danych w aplikacji mobilnej i desktopowej IdeaSol CRM.",
};

const sections = [
  {
    title: "1. Administrator danych",
    content: (
      <>
        <p>
          Administratorem danych osobowych przetwarzanych w IdeaSol CRM jest
          <strong> IdeaSol sp. z o.o.</strong>, ul. Złota 23/316, 25-015 Kielce,
          KRS 0001254586, NIP 9592095104, REGON 545265529.
        </p>
        <p>
          W sprawach dotyczących prywatności i realizacji praw skontaktuj się z
          nami pod adresem{" "}
          <a href="mailto:kontakt@ideasol.pl">kontakt@ideasol.pl</a>.
        </p>
      </>
    ),
  },
  {
    title: "2. Kogo i czego dotyczy ta polityka",
    content: (
      <p>
        Polityka dotyczy aplikacji IdeaSol CRM na iOS, iPadOS i macOS oraz
        połączonego z nią systemu internetowego. Aplikacja jest zamkniętym
        narzędziem służbowym dla uprawnionych pracowników i współpracowników
        IdeaSol. Nie udostępnia publicznej rejestracji kont.
      </p>
    ),
  },
  {
    title: "3. Jakie dane przetwarzamy",
    content: (
      <>
        <p>W zależności od zakresu uprawnień i używanych funkcji przetwarzamy:</p>
        <ul>
          <li>
            dane konta użytkownika CRM: imię i nazwisko, adres e-mail, numer
            telefonu, identyfikator konta, rola i uprawnienia;
          </li>
          <li>
            dane klientów i osób kontaktowych: dane identyfikacyjne i kontaktowe,
            adresy, NIP, REGON, PESEL oraz informacje potrzebne do obsługi relacji
            handlowej;
          </li>
          <li>
            aktywności, terminy, notatki, treści wiadomości, oferty, kalkulacje,
            sprzedaże, informacje finansowe i historię współpracy;
          </li>
          <li>
            dokumenty i zdjęcia dodawane do spraw sprzedażowych oraz dane związane
            z przygotowaniem umów i podpisem elektronicznym;
          </li>
          <li>
            przybliżoną lokalizację urządzenia, wyłącznie po udzieleniu zgody i w
            celu wyświetlenia lokalnej prognozy pogody. Lokalizacja jest przed
            wysłaniem ograniczana do dokładności około jednego kilometra i nie
            jest łączona z profilem CRM.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Cele i podstawy przetwarzania",
    content: (
      <>
        <p>Dane przetwarzamy w celu:</p>
        <ul>
          <li>
            uwierzytelniania użytkowników, kontroli uprawnień i zapewnienia
            bezpieczeństwa systemu;
          </li>
          <li>
            obsługi klientów, kontaktów, kalendarza, ofert, sprzedaży, dokumentów,
            raportów i innych funkcji CRM;
          </li>
          <li>
            realizacji umów, obowiązków prawnych, rozliczeń i ochrony przed
            nadużyciami;
          </li>
          <li>
            organizacji pracy, kontroli jakości procesów oraz ustalania,
            dochodzenia i obrony roszczeń.
          </li>
        </ul>
        <p>
          Podstawą przetwarzania są odpowiednio: wykonanie umowy lub działań przed
          jej zawarciem, obowiązek prawny, prawnie uzasadniony interes IdeaSol oraz
          zgoda — gdy jest wymagana, w szczególności dla dostępu do lokalizacji.
        </p>
      </>
    ),
  },
  {
    title: "5. Odbiorcy danych i infrastruktura",
    content: (
      <>
        <p>
          Dane mogą być powierzane dostawcom wspierającym działanie systemu,
          w szczególności usług bazodanowych, uwierzytelniania, hostingu,
          przechowywania plików, poczty elektronicznej, podpisu elektronicznego,
          bezpieczeństwa i utrzymania IT. Aplikacja korzysta między innymi z
          infrastruktury Supabase i Microsoft oraz z serwisu pogodowego met.no.
        </p>
        <p>
          Dostawcy otrzymują wyłącznie dane niezbędne do realizacji powierzonych
          zadań. Jeżeli przetwarzanie odbywa się poza Europejskim Obszarem
          Gospodarczym, stosujemy mechanizmy wymagane przez RODO, w tym decyzje o
          odpowiednim stopniu ochrony lub standardowe klauzule umowne.
        </p>
      </>
    ),
  },
  {
    title: "6. Okres przechowywania",
    content: (
      <p>
        Dane przechowujemy przez okres korzystania z CRM oraz przez czas niezbędny
        do realizacji celów biznesowych i obowiązków prawnych, w tym do upływu
        terminów przedawnienia roszczeń. Dane mogą zostać usunięte lub
        zanonimizowane wcześniej, jeżeli nie są już potrzebne i nie istnieje
        obowiązek ich dalszego przechowywania.
      </p>
    ),
  },
  {
    title: "7. Prawa osób, których dane dotyczą",
    content: (
      <>
        <p>
          W granicach przewidzianych prawem przysługuje Ci prawo dostępu do danych,
          ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia,
          wniesienia sprzeciwu oraz wycofania zgody. Wycofanie zgody nie wpływa na
          zgodność wcześniejszego przetwarzania.
        </p>
        <p>
          Żądanie możesz przesłać na{" "}
          <a href="mailto:kontakt@ideasol.pl">kontakt@ideasol.pl</a>. Masz również
          prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych.
        </p>
      </>
    ),
  },
  {
    title: "8. Śledzenie, reklamy i analityka",
    content: (
      <p>
        IdeaSol CRM nie wyświetla reklam, nie korzysta z identyfikatora reklamowego
        urządzenia i nie łączy danych z danymi innych firm w celu śledzenia,
        profilowania reklamowego ani pomiaru reklam.
      </p>
    ),
  },
  {
    title: "9. Bezpieczeństwo i zmiany polityki",
    content: (
      <p>
        Stosujemy środki techniczne i organizacyjne odpowiednie do ryzyka, w tym
        szyfrowane połączenia, uwierzytelnianie, kontrolę uprawnień, ograniczanie
        dostępu i rejestrowanie istotnych operacji. Polityka może być aktualizowana
        wraz ze zmianami aplikacji, dostawców lub prawa. Aktualna wersja jest zawsze
        dostępna pod tym adresem.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f4f7f8] px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <header className="relative overflow-hidden bg-[#09253a] px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#b8ff45]/20 blur-3xl" />
          <div className="relative">
            <Image
              src="/logo.png"
              alt="IdeaSol"
              width={64}
              height={64}
              className="mb-7 rounded-2xl bg-white object-contain p-2 shadow-lg"
              priority
            />
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-[#caff6a]">
              Ochrona danych
            </p>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
              Polityka prywatności aplikacji IdeaSol CRM
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              Jasne zasady dotyczące danych przetwarzanych w mobilnym i desktopowym
              narzędziu pracy zespołu IdeaSol.
            </p>
            <p className="mt-6 text-sm font-semibold text-slate-300">
              Wersja 1.0 · obowiązuje od 17 września 2026 r.
            </p>
          </div>
        </header>

        <div className="space-y-10 px-6 py-10 sm:px-10 sm:py-14">
          {sections.map((section) => (
            <section key={section.title} className="scroll-mt-8">
              <h2 className="text-xl font-extrabold tracking-tight text-[#09253a] dark:text-slate-100 sm:text-2xl">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-600 [&_a]:font-bold [&_a]:text-[#0e6b7b] [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-bold [&_strong]:text-slate-800 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-6 py-8 text-sm leading-6 text-slate-600 sm:px-10">
          <p className="font-bold text-slate-800">IdeaSol sp. z o.o.</p>
          <p>ul. Złota 23/316, 25-015 Kielce</p>
          <p>KRS 0001254586 · NIP 9592095104 · REGON 545265529</p>
          <a className="mt-2 inline-block font-bold text-[#0e6b7b]" href="mailto:kontakt@ideasol.pl">
            kontakt@ideasol.pl
          </a>
        </footer>
      </article>
    </main>
  );
}
