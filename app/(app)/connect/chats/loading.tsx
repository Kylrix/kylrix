export default function Loading() {
  return (
    <div className="flex-1 min-h-screen bg-black p-4 flex gap-4 animate-pulse">
      <div className="w-[320px] hidden md:block space-y-3">
        {[1,2,3,4,5].map((i) => (
          <div key={i} className="h-[72px] bg-[#161412] border border-white/[0.06] rounded-2xl" />
        ))}
      </div>
      <div className="flex-1 h-[70vh] bg-[#161412] border border-white/[0.06] rounded-[24px]" />
    </div>
  );
}
