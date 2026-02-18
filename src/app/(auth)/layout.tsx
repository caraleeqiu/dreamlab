export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Dreamlab</h1>
          <p className="text-sm text-zinc-500 mt-1">AI 红网工厂</p>
        </div>
        {children}
      </div>
    </div>
  )
}
