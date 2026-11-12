"use client";

import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useDragControls } from "motion/react";

/** Bottom sheet: springs up, drags down to dismiss, traps focus. */
export default function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  spill = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Let the body paint outside its scroll area, for effects that leave it. */
  spill?: boolean;
}) {
  const drag = useDragControls();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined} onOpenAutoFocus={(event) => event.preventDefault()}>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-card shadow-float outline-none"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 34, stiffness: 380, mass: 0.9 }}
                drag="y"
                dragControls={drag}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={(_event, info) => {
                  if (info.offset.y > 110 || info.velocity.y > 600) onOpenChange(false);
                }}
              >
                <div
                  className="shrink-0 cursor-grab touch-none px-6 pt-3 pb-2 active:cursor-grabbing"
                  onPointerDown={(event) => drag.start(event)}
                >
                  <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-foreground/15" />
                  <Dialog.Title className="text-xl font-extrabold tracking-tight">{title}</Dialog.Title>
                  {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
                </div>
                <div className={`min-h-0 flex-1 space-y-4 overscroll-contain px-6 pt-2 pb-4 ${spill ? "overflow-visible" : "overflow-y-auto"}`}>{children}</div>
                {footer && <div className="shrink-0 border-t border-black/[0.05] px-6 pt-3 pb-safe">{footer}</div>}
                {!footer && <div className="pb-safe" />}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
