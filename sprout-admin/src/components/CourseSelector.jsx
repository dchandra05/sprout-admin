// sprout-admin/src/components/CourseSelector.jsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronDown } from "lucide-react";
import { fetchCourses } from "@/lib/adminApi";

/**
 * CourseSelector
 * Renders a styled dropdown that lets the admin switch between courses.
 *
 * Props:
 *   selectedCourseId  — currently selected course id (or null for "All")
 *   onChange(course)  — called with the full course object, or null for "All"
 *   showAll           — whether to include an "All Courses" option (default: false)
 */
export default function CourseSelector({ selectedCourseId, onChange, showAll = false }) {
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn:  fetchCourses,
    staleTime: 1000 * 60 * 10, // courses rarely change
  });

  const selected = courses.find((c) => c.id === selectedCourseId) ?? null;

  const handleChange = (e) => {
    const val = e.target.value;
    if (val === "__all__") {
      onChange(null);
    } else {
      const course = courses.find((c) => c.id === val);
      if (course) onChange(course);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-ink-400 text-sm">
        <BookOpen className="w-4 h-4" />
        <span>Course</span>
      </div>

      <div className="relative">
        <select
          value={selectedCourseId ?? "__all__"}
          onChange={handleChange}
          disabled={isLoading}
          className="
            appearance-none
            bg-ink-800 border border-ink-700
            text-ink-100 text-sm
            rounded-xl pl-4 pr-10 py-2.5
            focus:outline-none focus:ring-1 focus:ring-sprout-500
            disabled:opacity-50 cursor-pointer
            min-w-[200px]
          "
        >
          {showAll && (
            <option value="__all__">All Courses</option>
          )}
          {isLoading ? (
            <option disabled>Loading…</option>
          ) : (
            courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" />
      </div>

      {selected && (
        <span className="text-ink-600 text-xs">
          {selected.total_days} days
        </span>
      )}
    </div>
  );
}