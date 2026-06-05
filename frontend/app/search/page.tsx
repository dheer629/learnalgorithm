import { SearchWorkspace } from "@/app/search/search-workspace";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const initialQuery = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");
  const categories = await api.categories();
  return <SearchWorkspace categories={categories} initialQuery={initialQuery} />;
}
