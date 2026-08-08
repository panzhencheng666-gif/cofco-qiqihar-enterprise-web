import { useMemo, useState } from "react";
import type { NavigationItem } from "@/app/router/navigation";
import { EnterpriseIcon } from "@/shared/enterprise-ui";

interface SearchResult {
  key: string;
  label: string;
  contextLabel?: string;
  path: string;
}

export function EnterpriseGlobalSearch({
  navigation,
  onNavigate,
}: {
  navigation: readonly NavigationItem[];
  onNavigate: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return [];

    const candidates: SearchResult[] = navigation.flatMap((application) => [
      {
        key: `application:${application.key}`,
        label: application.label,
        path: application.path,
      },
      ...application.contextItems.map((context) => ({
        key: `context:${application.key}:${context.key}`,
        label: context.label,
        contextLabel: application.label,
        path: context.path,
      })),
    ]);

    return candidates
      .filter((candidate) =>
        `${candidate.label}${candidate.contextLabel ?? ""}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalized),
      )
      .slice(0, 8);
  }, [navigation, query]);

  function choose(result: SearchResult) {
    setQuery("");
    setActiveIndex(0);
    onNavigate(result.path);
  }

  return (
    <div className="enterprise-global-search">
      <EnterpriseIcon name="search" />
      <input
        type="search"
        aria-label="搜索应用和工作区"
        aria-controls="enterprise-global-search-results"
        aria-activedescendant={
          results[activeIndex]
            ? `enterprise-global-search-option-${results[activeIndex].key}`
            : undefined
        }
        aria-expanded={results.length > 0}
        placeholder="搜索应用和工作区"
        value={query}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && results.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
          }
          if (event.key === "ArrowUp" && results.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && results[activeIndex]) {
            event.preventDefault();
            choose(results[activeIndex]);
          }
          if (event.key === "Escape") {
            setQuery("");
            setActiveIndex(0);
          }
        }}
      />
      {results.length > 0 && (
        <div
          id="enterprise-global-search-results"
          className="enterprise-global-search-results"
          role="listbox"
          aria-label="搜索结果"
        >
          {results.map((result, index) => (
            <button
              key={result.key}
              id={`enterprise-global-search-option-${result.key}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              aria-label={result.label}
              onClick={() => choose(result)}
            >
              <strong>{result.label}</strong>
              <span>{result.contextLabel ?? "业务应用"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
