import { Button } from "./components/Button";
import { Container } from "./components/Container";
import { Section } from "./components/Section";
import { ImageWithFallback } from "./components/figma/image-with-fallback";
import { gradients, splashPageStyles } from "./constants/design-system";

export default function Home() {
  return (
    <div className={splashPageStyles.root}>
      <Section variant="hero" className={splashPageStyles.hero.sectionPadding}>
        <div className={splashPageStyles.hero.backgroundLayer}>
          <ImageWithFallback
            src="/images/splash-page/L7308703.jpg"
            alt="Sabre fencing action"
            className={splashPageStyles.hero.backgroundImage}
          />
          <div className={`absolute inset-0 ${gradients.heroOverlay}`} />
          <div className={`absolute inset-0 ${gradients.darkOverlay}`} />
        </div>

        <Container size="lg" className={splashPageStyles.hero.content}>
          <h1 className={splashPageStyles.hero.title}>What&apos;s The Call?</h1>

          <div className={splashPageStyles.hero.actions}>
            <Button type="button" variant="primary">
              Sign Up
            </Button>
            <Button type="button" variant="secondary">
              Log In
            </Button>
          </div>
        </Container>
      </Section>

      <Section variant="gray">
        <Container size="md">
          <h2 className={splashPageStyles.about.title}>About</h2>

          <p className={splashPageStyles.about.body}>
            What&apos;s The Call is a community project for fencing referees and enthusiasts to review actions
            and share their decisions. Users watch short clips from bouts and submit their calls, helping
            build a dataset of how different referees interpret priority and right-of-way. By collecting many
            perspectives on the same actions, the project aims to better understand how refereeing decisions
            are made and how conventions are applied in practice.
          </p>
        </Container>
      </Section>
    </div>
  );
}