import Image from "next/image";
import Link from "next/link";
import { SiteBrand } from "./components/SiteBrand";

export default function Home() {
  return (
    <>
      <header className="public-header">
        <div className="site-container public-header-inner">
          <SiteBrand />
          <nav className="public-links" aria-label="Main navigation">
            <a href="#about" className="about-link">About the project</a>
            <Link href="/login" className="secondary-btn">Log in</Link>
            <Link href="/signup" className="primary-btn"><span className="desktop-label">Join with an invite</span><span className="mobile-label">Join</span> <span aria-hidden="true">↗</span></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-grid" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">A closer look at every touch</p>
            <h1 id="hero-title" className="display-title">One action.<br /><em>Many calls.</em></h1>
            <p className="lede">Watch real fencing actions, make your decision, and discover how other referees see the same moment.</p>
            <div className="hero-actions">
              <Link href="/signup" className="primary-btn">Join with an invite <span aria-hidden="true">↗</span></Link>
              <Link href="/login" className="secondary-btn">I&apos;m already a member</Link>
            </div>
          </div>
          <div className="hero-visual">
            <Image src="/images/splash-page/L7308703.jpg" alt="A saber fencer on the piste" fill priority sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
        </section>

        <section className="public-section site-container" aria-labelledby="how-it-works">
          <div className="section-heading">
            <div><p className="eyebrow">The practice</p><h2 id="how-it-works" className="section-title">One clip. A call of your own.</h2></div>
            <p className="lede">A simple rhythm that makes room for both quick instincts and careful replays.</p>
          </div>
          <div className="steps-grid">
            <div className="step"><span className="step-number">01</span><h3>Watch</h3><p>Study a short action from a real bout. Replay the moment as many times as you need.</p></div>
            <div className="step"><span className="step-number">02</span><h3>Decide</h3><p>Make the call for left, right, or no touch before seeing what anyone else chose.</p></div>
            <div className="step"><span className="step-number">03</span><h3>Compare</h3><p>See how the community interpreted the same action and reflect on the differences.</p></div>
          </div>
        </section>

        <section id="about" className="story-band" aria-labelledby="about-title">
          <div className="site-container story-inner">
            <div><p className="eyebrow">About the project</p><h2 id="about-title" className="section-title">The interesting part is how we see it.</h2></div>
            <div>
              <p>What&apos;s The Call? is a community project for fencing referees and enthusiasts to review actions and share their decisions.</p>
              <p>Each call adds another perspective to a growing picture of how priority and right of way are understood in practice. The goal is to learn from those differences, one action at a time.</p>
            </div>
          </div>
        </section>

        <section className="public-cta site-container">
          <p className="eyebrow">Take your place</p>
          <h2 className="section-title">There is always another action to study.</h2>
          <Link href="/signup" className="primary-btn">Join with an invite <span aria-hidden="true">↗</span></Link>
        </section>
      </main>
      <footer className="public-footer"><div className="site-container"><span>© {new Date().getFullYear()} What&apos;s The Call?</span><span>Made for the fencing community.</span></div></footer>
    </>
  );
}
