import { SearchWorkspace } from "@/app/search/search-workspace";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const categories = await api.categories();
  return (
    <SearchWorkspace
      categories={categories}
      initialFilters={{
        q: firstParam(params.q),
        category: firstParam(params.category),
        difficulty: firstParam(params.difficulty),
        tags: firstParam(params.tags),
        sort: firstParam(params.sort)
      }}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
