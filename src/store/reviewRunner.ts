import { reviewGame } from '../engine/review';
import { useGame } from './game';
import { toast } from './ui';

let ctrl: AbortController | null = null;

/** Open the current/finished game on the analysis board and run a full engine review. */
export async function startReview() {
  const s = useGame.getState();
  if (s.plies.length === 0) return;
  if (s.mode !== 'analysis') {
    const { startFen, plies, meta, result } = s;
    s.startAnalysis({ startFen, plies, meta });
    useGame.setState({ result, viewPly: 0 });
  }
  ctrl?.abort();
  const mine = new AbortController();
  ctrl = mine;
  const { startFen, plies, setReview } = useGame.getState();
  setReview(null, 0);
  try {
    const data = await reviewGame(startFen, plies, (p) => {
      if (!mine.signal.aborted) useGame.setState({ reviewProgress: p });
    }, mine.signal);
    if (!mine.signal.aborted && data) setReview(data, null);
  } catch (err) {
    console.error('[review]', err);
    if (!mine.signal.aborted) {
      setReview(null, null);
      toast('Game review failed. The engine could not be loaded.');
    }
  } finally {
    if (ctrl === mine) ctrl = null;
  }
}

export function cancelReview() {
  ctrl?.abort();
  ctrl = null;
  useGame.setState({ reviewProgress: null });
}

// Any change of game cancels a running review.
useGame.subscribe((s, prev) => {
  if (ctrl && s.id !== prev.id) cancelReview();
});
