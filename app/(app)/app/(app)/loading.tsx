export default function Loading() {
  return (
    <div className="flex-1 min-h-screen bg-[#161412] p-4 md:p-8 animate-pulse">
      <div className="w-full max-w-[1200px] mx-auto space-y-6">
        <div className="h-8 w-40 bg-[#000000] border border-white/[0.08] rounded-xl" />
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-[160px] bg-[#000000] border border-white/[0.08] rounded-[26px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
