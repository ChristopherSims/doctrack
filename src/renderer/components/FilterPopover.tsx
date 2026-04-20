import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Filter, X } from 'lucide-react';
import type { RequirementFilter } from '../../types/index';

interface FilterPopoverProps {
  filter: RequirementFilter;
  onFilterChange: (filter: RequirementFilter) => void;
  isFilterActive: boolean;
  availableTags?: string[];
}

const FILTER_FIELDS: { key: keyof RequirementFilter; label: string; placeholder: string }[] = [
  { key: 'status', label: 'Status', placeholder: 'e.g. draft, approved...' },
  { key: 'priority', label: 'Priority', placeholder: 'e.g. high, medium...' },
  { key: 'verification', label: 'Verification', placeholder: 'e.g. manual, unit_test...' },
  { key: 'tags', label: 'Tags', placeholder: 'e.g. safety, performance...' },
];

const FilterPopover: React.FC<FilterPopoverProps> = ({
  filter,
  onFilterChange,
  isFilterActive,
  availableTags = [],
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Delay to avoid the opening click immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const handleFieldChange = useCallback(
    (field: keyof RequirementFilter, value: string) => {
      onFilterChange({
        ...filter,
        [field]: value,
      });
    },
    [filter, onFilterChange],
  );

  const clearAll = useCallback(() => {
    onFilterChange({ status: '', priority: '', verification: '', tags: '' });
  }, [onFilterChange]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filter.status.trim()) count++;
    if (filter.priority.trim()) count++;
    if (filter.verification.trim()) count++;
    if (filter.tags.trim()) count++;
    return count;
  }, [filter]);

  // Tag suggestions
  const tagSuggestions = useMemo(() => {
    const q = filter.tags.toLowerCase().trim();
    if (!q || availableTags.length === 0) return [];
    return availableTags.filter(t => t.toLowerCase().includes(q)).slice(0, 5);
  }, [filter.tags, availableTags]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant={isFilterActive ? 'default' : 'ghost'}
        size="sm"
        className={`gap-1.5 ${
          isFilterActive
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : ''
        }`}
        onClick={() => setOpen(!open)}
      >
        <Filter className="h-4 w-4" />
        Filter
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-0.5 h-5 min-w-[20px] px-1 text-[10px] bg-white/20 text-white border-0">
            {activeCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[100] w-80 rounded-lg border bg-popover text-popover-foreground shadow-lg">
          <div className="p-3 space-y-3">
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
            <div className="space-y-2.5">
              {FILTER_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                  </label>
                  <div className="relative">
                    <Input
                      value={filter[key]}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      placeholder={placeholder}
                      className="h-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {filter[key].trim() && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFieldChange(key, ''); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Tag suggestions */}
                  {key === 'tags' && tagSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          onClick={(e) => { e.stopPropagation(); handleFieldChange('tags', tag); }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPopover;
