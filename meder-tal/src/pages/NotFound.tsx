import { PageHero } from "../components/PageHero";
import { TLink } from "../components/TLink";
import { useLang } from "../lib/i18n";
import { useTitle } from "../lib/useTitle";

export default function NotFound() {
  const { lang, t } = useLang();
  useTitle("404");
  return (
    <div key={lang}>
      <PageHero title={t.notFound.title} lead={t.notFound.text}>
        <TLink to="/" className="button">
          {t.notFound.back}
        </TLink>
      </PageHero>
    </div>
  );
}
