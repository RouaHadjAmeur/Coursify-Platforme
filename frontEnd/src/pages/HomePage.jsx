// src/pages/HomePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import CourseCarousel from "../components/CourseCarousel";
import AllCourses from "./AllCourses.jsx";

export default function HomePage() {
  const API_BASE = "http://localhost:3000";

  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Free carousel state
  const [expandedFree, setExpandedFree] = useState(false);

  // Level carousel state
  const LEVELS = [
    { key: "all", label: "All Levels" },
    { key: "beginner", label: "Beginner Level" },
    { key: "intermediate", label: "Intermediate Level" },
    { key: "advanced", label: "Advanced Level" },
  ];
  const [selectedLevel, setSelectedLevel] = useState(LEVELS[0].key);
  const [expandedByLevel, setExpandedByLevel] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/courses`);
        const data = await res.json();
        setAllCourses(Array.isArray(data) ? data : data?.courses ?? []);
      } catch (e) {
        console.error("Failed to load courses:", e);
        setAllCourses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Helpers
  const norm = (s) => (s ?? "").toString().toLowerCase();
  const isPublished = (c) => norm(c.status) === "published";
  const isFree = (c) =>
    c.isFree === true ||
    c.isFree === "true" ||
    c.is_free === true ||
    c.is_free === "true" ||
    (typeof c.price === "string" ? c.price.trim() === "0" : (c.price ?? 0) === 0);

  // ---------------------------
  // Carousel 1: Free + Published
  // ---------------------------
  const freePublished = useMemo(
    () => allCourses.filter((c) => isPublished(c) && isFree(c)),
    [allCourses]
  );
  const visibleFree = useMemo(
    () => (expandedFree ? freePublished : freePublished.slice(0, 4)),
    [expandedFree, freePublished]
  );
  const canToggleFree = freePublished.length > 4;

  // ----------------------------------------
  // Carousel 2: Published only, by Level
  // ----------------------------------------
  const publishedOnly = useMemo(
    () => allCourses.filter(isPublished),
    [allCourses]
  );

  const levelFiltered = useMemo(() => {
    if (selectedLevel === "all") return publishedOnly;
    return publishedOnly.filter((c) => norm(c.level) === selectedLevel);
  }, [publishedOnly, selectedLevel]);

  const visibleByLevel = useMemo(
    () => (expandedByLevel ? levelFiltered : levelFiltered.slice(0, 4)),
    [expandedByLevel, levelFiltered]
  );
  const canToggleByLevel = levelFiltered.length > 4;

  // Collapse the level section when switching tabs
  useEffect(() => {
    setExpandedByLevel(false);
  }, [selectedLevel]);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-7xl space-y-10 p-6 md:p-10 pt-20">
        {/* Free Online Courses */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B0D0D3]" />
          </div>
        ) : (
          <CourseCarousel
            title="Free Online Courses"
            courses={visibleFree}
            expanded={expandedFree}
            actionLabel={
              canToggleFree
                ? expandedFree
                  ? "See Less Courses"
                  : `See All Courses (${freePublished.length})`
                : undefined
            }
            onAction={canToggleFree ? () => setExpandedFree((s) => !s) : undefined}
            paginateAll={true}
            perPage={8}
          />
        )}

        {/* Browse by Level (published, NOT restricted to free) */}
        {!loading && (
          <section className="rounded-2xl border border-black/5 bg-white/70 p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Browse by Level
              </h2>
            </div>

            {/* Level pills */}
            <div className="mb-4 flex flex-wrap gap-2">
              {LEVELS.map((lv) => {
                const active = selectedLevel === lv.key;
                return (
                  <button
                    key={lv.key}
                    onClick={() => setSelectedLevel(lv.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition
                      ${active
                        ? "bg-[#4DA3FF] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {lv.label}
                  </button>
                );
              })}
            </div>

            {/* Level-filtered carousel (published only) */}
            <CourseCarousel
              title={LEVELS.find((x) => x.key === selectedLevel)?.label || "All Levels"}
              courses={visibleByLevel}
              expanded={expandedByLevel}
              actionLabel={
                canToggleByLevel
                  ? expandedByLevel
                    ? "See Less Courses"
                    : `See All Courses (${levelFiltered.length})`
                  : undefined
              }
              onAction={canToggleByLevel ? () => setExpandedByLevel((s) => !s) : undefined}
              paginateAll={true}
              perPage={8}
            />

            {levelFiltered.length === 0 && (
              <p className="mt-4 text-sm text-gray-500">
                No courses found for this level yet.
              </p>
            )}
          </section>
        )}
      </main>
    </>
  );
}
