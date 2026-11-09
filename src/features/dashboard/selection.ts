// The chip filters on the group page (participants or metrics): null means
// all. Tapping a chip while all are shown focuses on it; after that, taps add
// or remove chips, and once every chip is on again it's "all" again.
export type Selection = Set<string> | null

export function toggleSelection(
  selected: Selection,
  id: string,
  total: number,
): Selection {
  if (selected === null) return new Set([id])
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next.size === total ? null : next
}

export function isSelected(selected: Selection, id: string) {
  return selected === null || selected.has(id)
}

// What tapping a chip will do, as its tooltip.
export function chipTitle(name: string, allShown: boolean, pressed: boolean) {
  if (allShown) return `Show only ${name} in the charts`
  return pressed ? `Hide ${name} from the charts` : `Show ${name} in the charts`
}
