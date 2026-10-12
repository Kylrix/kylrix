export default function Loading() {
  return (
    <div className="flex-1 min-h-screen bg-black p-4 md:p-8 animate-pulse">
      <div className="w-full max-w-[1200px] mx-auto space-y-6">
        <div className="h-8 w-32 bg-[#161412] border border-white/[0.06] rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-[180px] bg-[#161412] border border-white/[0.06] rounded-[28px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
