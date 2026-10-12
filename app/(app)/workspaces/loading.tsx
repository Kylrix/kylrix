export default function Loading() {
  return (
    <div className="flex-1 min-h-screen bg-black p-4 md:p-8 animate-pulse">
      <div className="w-full max-w-[1200px] mx-auto space-y-6">
        <div className="h-8 w-40 bg-[#161412] border border-white/[0.06] rounded-xl" />
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-[140px] bg-[#161412] border border-white/[0.06] rounded-[24px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
