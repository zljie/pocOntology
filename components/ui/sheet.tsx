"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps extends React.ComponentPropsWithRef<"div"> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showOverlay?: boolean;
}

const Sheet: React.FC<SheetProps> = ({ children, open, onOpenChange, showOverlay = true, ...props }) => {
  const isOpen = open ?? true;

  return (
    <div {...props}>
      {isOpen && children}
      {isOpen && showOverlay && (
        <div
          className="fixed inset-0 z-[40] bg-black/80"
          onClick={() => onOpenChange?.(false)}
        />
      )}
    </div>
  );
};

const sheetVariants = cva(
  "fixed z-[50] gap-4 bg-[#1a1a1a] shadow-lg transition ease-in-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b h-auto",
        bottom: "inset-x-0 bottom-0 border-t h-auto",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-[500px] border-l sm:w-[540px]",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

interface SheetContentProps
  extends React.ComponentPropsWithRef<"div">,
    VariantProps<typeof sheetVariants> {
  showClose?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SheetContent = React.forwardRef<
  React.ElementRef<"div">,
  SheetContentProps
>(({ side = "right", className, children, showClose = true, onOpenChange, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(sheetVariants({ side }), "flex flex-col", className)}
    {...props}
  >
    {/* 可见的关闭按钮 */}
    {showClose && (
      <button
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#5b8def] focus:ring-offset-2 bg-[#2d2d2d] p-1.5 hover:bg-[#3d3d3d]"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange?.(false);
        }}
        aria-label="关闭"
      >
        <X className="h-4 w-4 text-white" />
      </button>
    )}
    {children}
  </div>
));
SheetContent.displayName = "SheetContent";

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
