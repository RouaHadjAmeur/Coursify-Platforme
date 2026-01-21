// CourseCarousel.jsx
import { useMemo, useState } from "react";
import CourseCard from "./CourseCard";

/**
 * Props:
 * - title: string
 * - courses: Course[]                             // full list
 * - viewAllHref?: string
 * - actionLabel?: string
 * - onAction?: () => void
 * - perPage?: number                              // how many cards per page for the "rest"
 * - showFeatured?: boolean                        // show top 4 as "featured" before the paginated grid
 */
export default function CourseCarousel({
  title,
  viewAllHref = "#",
  courses = [],
  actionLabel,
  onAction,
  perPage = 4,
  showFeatured = true,
  paginateAll = false,
}) {
  const [page, setPage] = useState(1);

  const featured = useMemo(
    () => (paginateAll ? [] : (showFeatured ? courses.slice(0, 4) : [])),
    [courses, showFeatured, paginateAll]
  );
  const rest = useMemo(
    () => (paginateAll ? courses : (showFeatured ? courses.slice(4) : courses)),
    [courses, showFeatured, paginateAll]
  );

  const pageCount = Math.max(1, Math.ceil(rest.length / perPage));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * perPage;
  const pageItems = rest.slice(start, start + perPage);

  const ctaPill =
    "inline-flex items-center gap-1 text-sm font-semibold " +
    "bg-[#C08497] text-white px-4 py-2 rounded-full " +
    "hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-[#C08497]/40";

  function pageList(current, total) {
    // 1, 2, ..., current-1, current, current+1, ..., total-1, total
    const set = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
    return Array.from(set)
      .filter((p) => p >= 1 && p <= total)
      .sort((a, b) => a - b);
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white/70 p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>

        {onAction && actionLabel ? (
          <button type="button" onClick={onAction} className={ctaPill}>
            {actionLabel}
            <span aria-hidden>→</span>
          </button>
        ) : (
          viewAllHref && (
            <a href={viewAllHref} className={ctaPill} aria-label="See all courses">
              See all courses <span aria-hidden>→</span>
            </a>
          )
        )}
      </div>

      {/* Featured (max 4) */}
      {featured.length > 0 && (
        <div className="mb-6">
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            role="list"
          >
            {featured.map((c) => (
              <div key={c.id} role="listitem" className="h-full">
                <CourseCard 
                  {...c} 
                  onStart={() => {
                    // Navigate to the course learning page
                    window.location.href = `/course/${c.id}`;
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">Showing up to 4 featured courses</div>
        </div>
      )}

      {/* Paginated grid for the rest */}
      {rest.length > 0 ? (
        <>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            role="list"
          >
            {pageItems.map((c) => (
              <div key={c.id} role="listitem" className="h-full">
                <CourseCard 
                  {...c} 
                  onStart={() => {
                    // Navigate to the course learning page
                    window.location.href = `/course/${c.id}`;
                  }}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <nav
              className="mt-6 flex items-center justify-center gap-1 select-none"
              aria-label="Pagination"
            >
              {/* Prev */}
              <button
                className={`h-9 w-9 rounded-md border text-sm ${
                  currentPage === 1
                    ? "text-gray-300 border-gray-200 cursor-not-allowed"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => currentPage > 1 && setPage(currentPage - 1)}
                aria-label="Previous page"
              >
                ‹
              </button>

              {/* Numbers + ellipses */}
              {(() => {
                const numbers = pageList(currentPage, pageCount);
                let last = 0;
                return numbers.map((p, idx) => {
                  const dots =
                    p - last > 1 ? (
                      <span key={`dots-${idx}`} className="px-2 text-gray-400">
                        …
                      </span>
                    ) : null;

                  const btn = (
                    <button
                      key={`page-${p}`}
                      onClick={() => setPage(p)}
                      className={`min-w-9 h-9 px-2 rounded-md border text-sm ${
                        p === currentPage
                          ? "border-blue-600 text-blue-600 ring-1 ring-blue-600 bg-blue-50"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                      aria-current={p === currentPage ? "page" : undefined}
                    >
                      {p}
                    </button>
                  );

                  last = p;
                  return (
                    <span key={`grp-${p}`} className="inline-flex items-center">
                      {dots}
                      {btn}
                    </span>
                  );
                });
              })()}

              {/* Next */}
              <button
                className={`h-9 w-9 rounded-md border text-sm ${
                  currentPage === pageCount
                    ? "text-gray-300 border-gray-200 cursor-not-allowed"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => currentPage < pageCount && setPage(currentPage + 1)}
                aria-label="Next page"
              >
                ›
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="px-2 py-6 text-sm text-gray-500">No more courses to show.</div>
      )}
    </section>
  );
}
