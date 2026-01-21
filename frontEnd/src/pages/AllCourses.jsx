import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import CourseCard from "../components/CourseCard";

export default function AllCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("All");

  // fetch published courses
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/courses");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.courses ?? [];
        const published = arr.filter(
          (c) => (c.status || "").toLowerCase() === "published"
        );
        setCourses(published);
      } catch (err) {
        console.error("Error loading courses:", err);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const norm = (s) => (s ?? "").toString().trim();

  const getCategory = (c) => {
    const raw = c?.category ?? c?.categories ?? "";
    if (Array.isArray(raw)) {
      const first = raw.map(norm).find(Boolean);
      return first || "Uncategorized";
    }
    const str = norm(raw);
    if (!str) return "Uncategorized";
    // support comma/pipe separated categories, pick the first token
    const first = str.split(/[,|]/).map(norm).find(Boolean);
    return first || "Uncategorized";
  };

  // build category list dynamically from fetched courses (auto-updates on new category)
  const categoryList = useMemo(() => {
    const set = new Set();
    for (const c of courses) set.add(getCategory(c));
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    // keep "Uncategorized" at the end if present
    const uncIdx = arr.indexOf("Uncategorized");
    if (uncIdx > -1) {
      arr.splice(uncIdx, 1);
      arr.push("Uncategorized");
    }
    return arr;
  }, [courses]);

  // group courses by category
  const grouped = useMemo(() => {
    const map = new Map(categoryList.map((c) => [c, []]));
    for (const course of courses) {
      const cat = getCategory(course);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(course);
    }
    for (const key of map.keys()) {
      map.get(key).sort((a, b) => norm(a.title).localeCompare(norm(b.title)));
    }
    return map;
  }, [courses, categoryList]);

  const totalCount = courses.length;

  // read ?cat= once and keep in sync with available categories
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qs = params.get("cat");
    if (qs && (qs === "All" || categoryList.includes(qs))) {
      setActiveCat(qs);
    } else if (!categoryList.includes(activeCat) && activeCat !== "All") {
      setActiveCat("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryList]);

  const visibleCategories = useMemo(() => {
    return activeCat === "All"
      ? categoryList
      : categoryList.includes(activeCat)
      ? [activeCat]
      : [];
  }, [activeCat, categoryList]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl p-6 md:p-10 pt-20 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">All Courses</h1>
            {!loading && (
              <p className="mt-1 text-sm text-gray-600">
                {totalCount} course{totalCount === 1 ? "" : "s"} published
              </p>
            )}
          </div>
        </div>

        {/* Category pills */}
        {!loading && (
          <div className="flex flex-wrap gap-2">
            {["All", ...categoryList].map((cat) => {
              const isActive = activeCat === cat;
              const count = cat === "All" ? totalCount : grouped.get(cat)?.length ?? 0;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition
                    ${isActive ? "bg-[#4DA3FF] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  {cat} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B0D0D3]" />
          </div>
        ) : (
          <div className="space-y-10">
            {visibleCategories.map((cat) => {
              const list = grouped.get(cat) ?? [];
              return (
                <section
                  key={cat}
                  className="rounded-2xl border border-black/5 bg-white/70 p-4 md:p-6"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900">
                      {cat}{" "}
                      <span className="ml-1 text-gray-500 text-sm">
                        ({list.length})
                      </span>
                    </h2>
                  </div>

                  {list.length > 0 ? (
                    <>
                      <div
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        role="list"
                      >
                        {list.slice(0, 8).map((course) => (
                          <div key={course.id} role="listitem" className="h-full">
                            <CourseCard 
                              {...course} 
                              onStart={() => {
                                // Navigate to the frontend course learning page
                                window.location.href = `/course/${course.id}`;
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      {list.length > 8 && (
                        <div className="mt-4 text-right">
                          <a href="/all-courses" className="text-sm text-[#4DA3FF] hover:underline">See all</a>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-gray-500 py-6">
                      No courses yet in this category.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
