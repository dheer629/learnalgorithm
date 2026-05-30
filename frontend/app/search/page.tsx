import { SearchWorkspace } from "@/app/search/search-workspace";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const categories = await api.categories();
  return <SearchWorkspace categories={categories} initialQuery={searchParams.q ?? ""} />;
}
