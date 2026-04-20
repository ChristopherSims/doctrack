import React, { useCallback, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Filter, X } from 'lucide-react';
import type { RequirementFilter } from '../../types/index';

interface FilterPopoverProps {
  filter: RequirementFilter;
  onFilterChange: (filter: RequirementFilter) => void;
  isFilterActive: boolean;
  /** Tags available in the current document — fetched from API */
  availableTags?: string[];
}

const STATUS_OPTIONS = ['draft', 'review', 'approved', 'implemented', 'verified'] as const;
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
const VERIFICATION_OPTIONS = ['manual', 'unit_test', 'integration_test', 'code_review', 'inspection', 'analysis', 'demonstration'] as const;

const statusColorMap: Record<string, string> = {
  draft: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30',
  review: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  implemented: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  verified: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
};

const priorityColorMap: Record<string, string> = {
  high: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
};

function FilterChipGroup({
  label,
  options,
  selected,
  onToggle,
  colorMap,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                isActive
                  ? colorMap?.[opt] || 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {opt.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FilterPopover: React.FC<FilterPopoverProps> = ({
  filter,
  onFilterChange,
  isFilterActive,
  availableTags = [],
}) => {
  const toggleValue = useCallback(
    (field: keyof RequirementFilter, value: string) => {
      onFilterChange({
        ...filter,
        [field]: filter[field].includes(value)
          ? filter[field].filter((v) => v !== value)
          : [...filter[field], value],
      });
    },
    [filter, onFilterChange],
  );

  const clearAll = useCallback(() => {
    onFilterChange({ status: [], priority: [], verification: [], tags: [] });
  }, [onFilterChange]);

  const activeCount = useMemo(
    () => filter.status.length + filter.priority.length + filter.verification.length + filter.tags.length,
    [filter],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isFilterActive ? 'default' : 'ghost'}
          size="sm"
          className={`gap-1.5 ${
            isFilterActive
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : ''
          }`}
        >
          <Filter className="h-4 w-4" />
          Filter
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-[20px] px-1 text-[10px] bg-white/20 text-white border-0">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Filter Requirements</p>
          {isFilterActive && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
        <Separator />
        <FilterChipGroup
          label="Status"
          options={STATUS_OPTIONS}
          selected={filter.status}
          onToggle={(v) => toggleValue('status', v)}
          colorMap={statusColorMap}
        />
        <FilterChipGroup
          label="Priority"
          options={PRIORITY_OPTIONS}
          selected={filter.priority}
          onToggle={(v) => toggleValue('priority', v)}
          colorMap={priorityColorMap}
        />
        <FilterChipGroup
          label="Verification"
          options={VERIFICATION_OPTIONS}
          selected={filter.verification}
          onToggle={(v) => toggleValue('verification', v)}
        />
        {availableTags.length > 0 && (
          <FilterChipGroup
            label="Tags"
            options={availableTags as unknown as readonly string[]}
            selected={filter.tags}
            onToggle={(v) => toggleValue('tags', v)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FilterPopover;
