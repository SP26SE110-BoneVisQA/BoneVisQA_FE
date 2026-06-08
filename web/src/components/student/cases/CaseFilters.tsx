import React from 'react';
import { Search, ListFilter, Grid3X3, Filter } from 'lucide-react';

import { MEDICAL_CASE_DIFFICULTY_FILTER_OPTIONS } from '@/lib/medical-case-difficulty';

const difficultyFilters = MEDICAL_CASE_DIFFICULTY_FILTER_OPTIONS;

const regionFilters = [
  'All regions',
  'Upper Limb',
  'Lower Limb',
  'Spine',
  'Pelvis',
];

export default function CaseFilters() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Search */}
        <div className="w-full md:max-w-md">
          <label className="input input-bordered flex items-center gap-2 bg-input border-border focus-within:ring-2 focus-within:ring-ring">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="grow bg-transparent outline-none"
              placeholder="Search by title, region, lesion type..."
            />
          </label>
        </div>

        {/* View & sort controls */}
        <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-ghost gap-2 text-muted-foreground"
              type="button"
            >
              <ListFilter className="w-4 h-4" />
              Filters
            </button>
            <button
              className="btn btn-sm btn-outline gap-2 border-border"
              type="button"
            >
              <Grid3X3 className="w-4 h-4" />
              Grid view
            </button>
          </div>
          <select className="select select-sm select-bordered bg-input border-border text-sm">
            <option>Sort by Recommended</option>
            <option>Sort by Difficulty</option>
            <option>Sort by Duration</option>
            <option>Sort by Progress</option>
          </select>
        </div>
      </div>

      {/* Difficulty pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Difficulty
        </span>
        <div className="flex flex-wrap gap-2">
          {difficultyFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`btn btn-xs rounded-full border-border bg-muted/40 text-xs ${
                filter.id === 'all'
                  ? 'btn-primary text-primary-content'
                  : 'btn-ghost text-muted-foreground'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Region select */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Region
        </span>
        <div className="flex flex-wrap gap-2">
          {regionFilters.map((region) => (
            <button
              key={region}
              type="button"
              className={`btn btn-xs rounded-full border-border bg-muted/40 text-xs ${
                region === 'All regions'
                  ? 'btn-outline border-primary/40 text-primary'
                  : 'btn-ghost text-muted-foreground'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
