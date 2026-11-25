import { Link } from 'react-router-dom';
import { arcadeButtonClass } from '../components/ui/ArcadeButton';
import { Blink } from '../components/ui/Blink';

export function NotFoundScreen() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <h1 className="text-pixel-hero text-neon-red @min-[640px]/shell:text-pixel-hero-lg">GAME OVER</h1>
      <p>THIS PAGE DOES NOT EXIST.</p>
      <p className="font-pixel text-pixel-title leading-normal text-neon-yellow">
        <Blink>CONTINUE?</Blink>
      </p>
      <Link to="/" className={arcadeButtonClass()}>
        {'>'} BACK TO START
      </Link>
    </div>
  );
}
