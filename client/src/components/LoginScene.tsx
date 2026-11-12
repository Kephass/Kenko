"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Stage geometry: the sun travels a half circle over the twin rings.
const CX = 180;
const CY = 190;
const ORBIT = 140;
const OUTER = 52;
const INNER = 37;
const OUTER_LENGTH = 2 * Math.PI * OUTER;
const INNER_LENGTH = 2 * Math.PI * INNER;
const DAY_S = 9;

const MEALS = [
  { at: 0.14, kcal: 520 },
  { at: 0.48, kcal: 1240 },
  { at: 0.8, kcal: 1980 },
];
const SIPS = [{ at: 0.31, fill: 0.5 }, { at: 0.64, fill: 1 }];
const MACRO_FILLS = ["var(--protein)", "var(--carbs)", "var(--fat)"];
const STARS = [[58, 52, 1.6], [104, 28, 1.1], [150, 62, 1.3], [226, 34, 1.7], [282, 58, 1.2], [318, 104, 1.4], [38, 118, 1.1]];
const CAPTIONS = [
  ["Morning", "Log breakfast in one tap."],
  ["Midday", "Watch your ring fill as you eat."],
  ["Afternoon", "Water counts. Every sip lands."],
  ["Night", "Close the day. Keep the streak."],
];

const orbit = (t: number) => ({ x: CX - ORBIT * Math.cos(Math.PI * t), y: CY - ORBIT * Math.sin(Math.PI * t) });

/** A looping day: the sun crosses, meals and water pour into the rings, night closes them. */
export default function LoginScene() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const media = gsap.matchMedia();

    media.add({ motion: "(prefers-reduced-motion: no-preference)", still: "(prefers-reduced-motion: reduce)" }, (context) => {
      const q = gsap.utils.selector(scope);
      const kcal = q(".kcal")[0];
      const streak = q(".streak-count")[0];
      const day = { t: 0 };
      const eaten = { value: 0 };
      const placeSun = () => {
        const { x, y } = orbit(day.t);
        gsap.set(q(".sun"), { x, y });
      };
      const writeKcal = () => { kcal.textContent = Math.round(eaten.value).toLocaleString(); };

      // Reduced motion: show the finished day and stop.
      if (context.conditions?.still) {
        day.t = 1;
        placeSun();
        gsap.set(q(".ring-outer"), { strokeDashoffset: 0 });
        gsap.set(q(".ring-inner"), { strokeDashoffset: 0 });
        gsap.set(q(".caption"), { autoAlpha: 0 });
        gsap.set(q(".caption-3"), { autoAlpha: 1 });
        gsap.set(q(".dot, .drop, .star, .done, .streak"), { autoAlpha: 0 });
        kcal.textContent = "1,980";
        return;
      }

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, defaults: { ease: "power2.out" } });

      // Dawn: everything back to an empty morning.
      tl.set(day, { t: 0, onComplete: placeSun })
        .set(eaten, { value: 0, onComplete: writeKcal })
        .call(() => { streak.textContent = "6"; placeSun(); writeKcal(); })
        .set(q(".stage"), { backgroundColor: "#ffffff", color: "#161616" })
        .set(q(".ring-outer"), { strokeDashoffset: OUTER_LENGTH })
        .set(q(".ring-inner"), { strokeDashoffset: INNER_LENGTH })
        .set(q(".rings"), { scale: 1, svgOrigin: `${CX} ${CY}` })
        .set(q(".moon-cut"), { attr: { cx: 30 } })
        .set(q(".sun-disc"), { fill: "var(--carbs)" })
        .set(q(".sun-glow"), { autoAlpha: 0.35, scale: 1, transformOrigin: "center" })
        .set(q(".star, .dot, .drop"), { autoAlpha: 0 })
        .set(q(".done"), { autoAlpha: 0, scale: 0, svgOrigin: `${CX} ${CY}` })
        .set(q(".count"), { autoAlpha: 1, scale: 1, svgOrigin: `${CX} ${CY}` })
        .set(q(".streak"), { autoAlpha: 0, scale: 0.4, transformOrigin: "center" })
        .set(q(".caption"), { autoAlpha: 0, y: 10 })
        .fromTo(q(".scene"), { autoAlpha: 0, scale: 0.96, transformOrigin: "center" }, { autoAlpha: 1, scale: 1, duration: 0.7 })
        .addLabel("day");

      // The sun's crossing drives the whole day.
      tl.to(day, { t: 1, duration: DAY_S, ease: "none", onUpdate: placeSun }, "day");
      tl.to(q(".sun-glow"), { scale: 1.25, duration: 1.4, repeat: 5, yoyo: true, ease: "sine.inOut" }, "day");

      // Captions change with the light: the last one waits for dusk.
      const cues = [0, 0.27, 0.54, 0.8, 1].map((at) => at * DAY_S);
      CAPTIONS.forEach((_, index) => {
        tl.to(q(`.caption-${index}`), { autoAlpha: 1, y: 0, duration: 0.5 }, `day+=${cues[index]}`);
        if (index < CAPTIONS.length - 1) tl.to(q(`.caption-${index}`), { autoAlpha: 0, y: -10, duration: 0.35, ease: "power2.in" }, `day+=${cues[index + 1] - 0.35}`);
      });

      // Meals: three macro dots leave the sun and curve into the outer ring.
      MEALS.forEach((meal, index) => {
        const time = meal.at * DAY_S;
        const from = orbit(meal.at);
        const dots = q(`.meal-${index}`);
        tl.set(dots, { autoAlpha: 1, attr: { cx: from.x, cy: from.y, r: 0 } }, `day+=${time}`)
          .to(dots, { attr: { r: 5.5 }, duration: 0.25, stagger: 0.07, ease: "back.out(3)" }, `day+=${time}`)
          .to(dots, { attr: { cx: CX }, duration: 0.75, stagger: 0.07, ease: "power1.inOut" }, `day+=${time + 0.12}`)
          .to(dots, { attr: { cy: CY - OUTER }, duration: 0.75, stagger: 0.07, ease: "power2.in" }, `day+=${time + 0.12}`)
          .to(dots, { attr: { r: 0 }, autoAlpha: 0, duration: 0.18, stagger: 0.07 }, `day+=${time + 0.8}`)
          .to(q(".ring-outer"), { strokeDashoffset: OUTER_LENGTH * (1 - (index + 1) / MEALS.length), duration: 1.1, ease: "elastic.out(1, 0.7)" }, `day+=${time + 0.85}`)
          .to(eaten, { value: meal.kcal, duration: 0.9, onUpdate: writeKcal }, `day+=${time + 0.85}`)
          .fromTo(q(".count"), { scale: 1.18 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, `day+=${time + 0.85}`);
      });

      // Water: drops fall from above into the inner ring.
      SIPS.forEach((sip, index) => {
        const time = sip.at * DAY_S;
        const drops = q(`.sip-${index}`);
        tl.set(drops, { autoAlpha: 1, attr: { cy: 70 } }, `day+=${time}`)
          .to(drops, { attr: { cy: CY - INNER }, duration: 0.55, stagger: 0.09, ease: "power2.in" }, `day+=${time}`)
          .to(drops, { autoAlpha: 0, duration: 0.1, stagger: 0.09 }, `day+=${time + 0.5}`)
          .to(q(".ring-inner"), { strokeDashoffset: INNER_LENGTH * (1 - sip.fill), duration: 1, ease: "elastic.out(1, 0.75)" }, `day+=${time + 0.55}`);
      });

      // Dusk: the card turns to night, the sun thins to a crescent, stars come out.
      const dusk = DAY_S * 0.8;
      tl.to(q(".stage"), { backgroundColor: "#131316", color: "#f5f5f6", duration: 1.6, ease: "sine.inOut" }, `day+=${dusk}`)
        .to(q(".sun-disc"), { fill: "#f5f5f6", duration: 1.2 }, `day+=${dusk}`)
        .to(q(".sun-glow"), { autoAlpha: 0, duration: 0.8 }, `day+=${dusk}`)
        .to(q(".moon-cut"), { attr: { cx: 6 }, duration: 1.2, ease: "sine.inOut" }, `day+=${dusk + 0.3}`)
        .to(q(".star"), { autoAlpha: 1, duration: 0.5, stagger: { each: 0.09, from: "random" } }, `day+=${dusk + 0.6}`)
        .to(q(".star"), { autoAlpha: 0.35, duration: 0.7, stagger: { each: 0.13, from: "random", repeat: 3, yoyo: true } }, `day+=${dusk + 1.4}`);

      // Night: the day closes with a tick and the streak goes up.
      tl.addLabel("close", `day+=${DAY_S + 0.2}`)
        .to(q(".count"), { autoAlpha: 0, scale: 0.6, duration: 0.25, ease: "power2.in" }, "close")
        .to(q(".done"), { autoAlpha: 1, scale: 1, duration: 0.6, ease: "back.out(2.4)" }, "close+=0.2")
        .fromTo(q(".done-tick"), { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" }, "close+=0.35")
        .to(q(".rings"), { scale: 1.07, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut" }, "close+=0.2")
        .to(q(".streak"), { autoAlpha: 1, scale: 1, duration: 0.6, ease: "back.out(2.6)" }, "close+=0.7")
        .call(() => { streak.textContent = "7"; }, undefined, "close+=1.15")
        .fromTo(q(".streak-count"), { y: 6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.3 }, "close+=1.15")
        .to(q(".scene, .caption"), { autoAlpha: 0, duration: 0.6, ease: "power2.in" }, "close+=3")
        .to(q(".stage"), { backgroundColor: "#ffffff", color: "#161616", duration: 0.6 }, "close+=3");
    });

    return () => media.revert();
  }, []);

  return (
    <div ref={root} className="w-full select-none" aria-hidden>
      <div className="stage relative overflow-hidden rounded-[2rem] bg-white text-[#161616] shadow-soft ring-1 ring-black/[0.04]">
        <svg viewBox="0 0 360 270" className="scene block w-full">
          <defs>
            <mask id="login-moon">
              <circle r="13" fill="white" />
              <circle className="moon-cut" cx="30" cy="-4" r="12" fill="black" />
            </mask>
          </defs>

          {STARS.map(([x, y, r], index) => <circle key={index} className="star" cx={x} cy={y} r={r} fill="currentColor" />)}

          <path d={`M${CX - ORBIT} ${CY} A${ORBIT} ${ORBIT} 0 0 1 ${CX + ORBIT} ${CY}`} fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
          <text x={CX - ORBIT} y={CY + 20} textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" fillOpacity="0.4" letterSpacing="1">AM</text>
          <text x={CX + ORBIT} y={CY + 20} textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" fillOpacity="0.4" letterSpacing="1">PM</text>

          <g className="rings">
            <g transform={`rotate(-90 ${CX} ${CY})`} fill="none" strokeLinecap="round">
              <circle cx={CX} cy={CY} r={OUTER} stroke="var(--carbs)" strokeOpacity="0.16" strokeWidth="12" />
              <circle className="ring-outer" cx={CX} cy={CY} r={OUTER} stroke="var(--carbs)" strokeWidth="12" strokeDasharray={OUTER_LENGTH} strokeDashoffset={OUTER_LENGTH} />
              <circle cx={CX} cy={CY} r={INNER} stroke="var(--water)" strokeOpacity="0.18" strokeWidth="10" />
              <circle className="ring-inner" cx={CX} cy={CY} r={INNER} stroke="var(--water)" strokeWidth="10" strokeDasharray={INNER_LENGTH} strokeDashoffset={INNER_LENGTH} />
            </g>
            <g className="count" fill="currentColor" textAnchor="middle">
              <text className="kcal" x={CX} y={CY + 3} fontSize="17" fontWeight="800" style={{ fontVariantNumeric: "tabular-nums" }}>0</text>
              <text x={CX} y={CY + 15} fontSize="8" fontWeight="600" fillOpacity="0.5">kcal</text>
            </g>
            <g className="done">
              <circle cx={CX} cy={CY} r="19" fill="var(--fiber)" />
              <path className="done-tick" d={`M${CX - 8} ${CY + 1} l6 6 l11 -12`} fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" />
            </g>
          </g>

          {MEALS.map((_, meal) => MACRO_FILLS.map((fill, dot) => <circle key={`${meal}-${dot}`} className={`dot meal-${meal}`} r="0" fill={fill} />))}
          {SIPS.map((_, sip) => [-9, 0, 9].map((offset, drop) => <circle key={`${sip}-${drop}`} className={`drop sip-${sip}`} cx={CX + offset} cy="70" r="3.5" fill="var(--water)" />))}

          <g className="sun">
            <circle className="sun-glow" r="24" fill="var(--carbs)" />
            <circle className="sun-disc" r="13" fill="var(--carbs)" mask="url(#login-moon)" />
          </g>

          <g className="streak">
            <rect x={CX + 46} y={CY - 84} width="50" height="26" rx="13" fill="var(--carbs)" />
            <path d={`M${CX + 60} ${CY - 64} c-5 0 -6.500 -5 -3 -8.500 c0.500 2 2 2.500 2.500 1 c0.500 -2 0 -4 -1 -5.500 c5 1.500 7.500 5.500 6.500 9 c-0.500 2.500 -2.500 4 -5 4z`} fill="white" />
            <text className="streak-count" x={CX + 80} y={CY - 66.500} textAnchor="middle" fontSize="12" fontWeight="800" fill="white">6</text>
          </g>
        </svg>
      </div>

      <div className="relative mt-5 h-12 text-center">
        {CAPTIONS.map(([when, line], index) => (
          <p key={when} className={`caption caption-${index} invisible absolute inset-x-0 top-0`}>
            <span className="block text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase">{when}</span>
            <span className="block text-lg font-semibold tracking-tight">{line}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
