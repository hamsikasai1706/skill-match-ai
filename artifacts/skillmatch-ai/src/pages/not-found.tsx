import { Link } from 'wouter';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="grid min-h-[58vh] place-items-center">
      <div className="surface w-full max-w-lg rounded-3xl px-7 py-10 text-center sm:px-12">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-violet-300/15 bg-violet-300/[.08] text-violet-200">
          <Compass size={24} strokeWidth={1.6} />
        </div>
        <div className="mt-6 font-mono text-xs tracking-[.24em] text-violet-300">404 · OFF PATH</div>
        <h1 className="mt-3 font-serif text-3xl font-extrabold tracking-[-.04em] text-slate-100">Nothing matched this address.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">The page may have moved, or the link may be incomplete. Head back and choose your next direction.</p>
        <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-400">
          <ArrowLeft size={15} /> Return to SkillMatch
        </Link>
      </div>
    </div>
  );
}
