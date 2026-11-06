// Dashed box marking where a feature's content will go.
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
