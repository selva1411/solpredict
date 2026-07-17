import { Variants, Transition } from "framer-motion";

export const fastTransition: Transition = { duration: 0.2, ease: "easeOut" };
export const normalTransition: Transition = { duration: 0.3, ease: "easeOut" };
export const slowTransition: Transition = { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] };

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: normalTransition },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: normalTransition },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: normalTransition },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: normalTransition },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

export const staggerSlow: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export const cardHover = {
  whileHover: { y: -2, transition: fastTransition },
  whileTap: { scale: 0.99, transition: fastTransition },
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
