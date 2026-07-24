'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

type SelectionLabels = {
  clear: string;
  onlyOpen: string;
  selectAll: string;
  selected: string;
};

type CollectionCheckbox = HTMLInputElement & {
  dataset: {
    collectionStatus?: string;
  };
};

function checkboxes(formId: string) {
  const form = document.getElementById(formId);

  if (!form) {
    return [];
  }

  return Array.from(form.querySelectorAll<CollectionCheckbox>('input[data-collection-status][name="lease_ids"]'));
}

function notifySelectionChange(formId: string) {
  window.dispatchEvent(new CustomEvent('collection-selection-change', {detail: {formId}}));
}

export function CollectionSelectionControls({formId, initialSelected, labels, total}: {formId: string; initialSelected: number; labels: SelectionLabels; total: number}) {
  const [selected, setSelected] = useState(initialSelected);
  const summary = useMemo(() => labels.selected.replace('{selected}', String(selected)).replace('{total}', String(total)), [labels.selected, selected, total]);

  const refreshSelected = useCallback(() => {
    setSelected(checkboxes(formId).filter((checkbox) => checkbox.checked).length);
  }, [formId]);

  useEffect(() => {
    const form = document.getElementById(formId);

    if (!form) {
      return;
    }

    function handleChange(event: Event) {
      const target = event.target;

      if (target instanceof HTMLInputElement && target.name === 'lease_ids') {
        refreshSelected();
        notifySelectionChange(formId);
      }
    }

    function handleExternalChange(event: Event) {
      if (event instanceof CustomEvent && event.detail?.formId === formId) {
        refreshSelected();
      }
    }

    form.addEventListener('change', handleChange);
    window.addEventListener('collection-selection-change', handleExternalChange);
    return () => {
      form.removeEventListener('change', handleChange);
      window.removeEventListener('collection-selection-change', handleExternalChange);
    };
  }, [formId, refreshSelected]);

  function setAll(checked: boolean) {
    for (const checkbox of checkboxes(formId)) {
      checkbox.checked = checked;
    }

    refreshSelected();
    notifySelectionChange(formId);
  }

  function selectOpen() {
    for (const checkbox of checkboxes(formId)) {
      checkbox.checked = checkbox.dataset.collectionStatus !== 'paid';
    }

    refreshSelected();
    notifySelectionChange(formId);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 text-sm font-semibold text-[#33413f]">{summary}</span>
      <button className="focus-ring min-h-9 rounded-md border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[#253331] hover:bg-[#f5faf8]" onClick={() => setAll(true)} type="button">
        {labels.selectAll}
      </button>
      <button className="focus-ring min-h-9 rounded-md border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[#253331] hover:bg-[#f5faf8]" onClick={selectOpen} type="button">
        {labels.onlyOpen}
      </button>
      <button className="focus-ring min-h-9 rounded-md border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[#253331] hover:bg-[#f5faf8]" onClick={() => setAll(false)} type="button">
        {labels.clear}
      </button>
    </div>
  );
}

export function CollectionSelectAllCheckbox({formId, initialSelected, labels, total}: {formId: string; initialSelected: number; labels: Pick<SelectionLabels, 'clear' | 'selectAll'>; total: number}) {
  const [selected, setSelected] = useState(initialSelected);
  const ref = useRef<HTMLInputElement>(null);
  const allSelected = total > 0 && selected === total;

  const syncSelected = useCallback(() => {
    setSelected(checkboxes(formId).filter((checkbox) => checkbox.checked).length);
  }, [formId]);

  useEffect(() => {
    const form = document.getElementById(formId);

    function handleSelectionEvent(event: Event) {
      if (event instanceof CustomEvent && event.detail?.formId !== formId) {
        return;
      }

      syncSelected();
    }

    form?.addEventListener('change', handleSelectionEvent);
    window.addEventListener('collection-selection-change', handleSelectionEvent);
    return () => {
      form?.removeEventListener('change', handleSelectionEvent);
      window.removeEventListener('collection-selection-change', handleSelectionEvent);
    };
  }, [formId, syncSelected]);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = selected > 0 && selected < total;
    }
  }, [selected, total]);

  function toggleAll() {
    for (const checkbox of checkboxes(formId)) {
      checkbox.checked = !allSelected;
    }

    syncSelected();
    notifySelectionChange(formId);
  }

  return <input aria-label={allSelected ? labels.clear : labels.selectAll} checked={allSelected} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" onChange={toggleAll} ref={ref} type="checkbox" />;
}
