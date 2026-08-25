
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import SectionHeading from "./SectionHeading"

/**
 * questions → [{ id, question, reponse }]
 * aside     → { icon, title, text, to, cta } (carte sous le titre, optionnelle)
 * separated → séparateurs entre items d'accordéon (Home : non, HowItWorks : oui)
 */
const FaqSection = ({
  eyebrow = "FAQ", title, sub, questions, aside,
  separated = true, defaultOpen,
  background = "bg-surface-container-lowest", className,
}) => (
  <section className={cn(background, "py-20 md:py-24", className)}>
    <div className="mx-auto grid max-w-7xl gap-12 px-6 md:px-12 lg:grid-cols-[0.9fr_1.1fr]">
      {/* Colonne gauche sticky */}
      <div className="self-start lg:sticky lg:top-28">
        <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />
        {aside && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-md rounded-xl border border-outline-variant/50 bg-card p-6 shadow-soft"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
              <aside.icon className="size-5" strokeWidth={2} />
            </span>
            <h3 className="mt-4 font-heading text-base font-bold text-brand-navy">{aside.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{aside.text}</p>
            <Link
              to={aside.to}
              className="group mt-4 inline-flex items-center gap-2 rounded-md bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-brand-navy/90"
            >
              {aside.cta}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>
        )}
      </div>
      {/* Accordéons */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <Accordion type="single" collapsible="true" defaultValue={defaultOpen ?? questions[0]?.id} className="w-full border-0">
          {questions.map((q) => (
            <AccordionItem key={q.id} value={q.id} className={cn("group", separated ? "border-outline-variant/40" : "border-0")}>
              <AccordionTrigger className="py-5 text-left font-heading text-[15px] font-bold text-brand-navy transition-colors duration-200 hover:text-brand-orange hover:no-underline group-data-open:text-brand-orange">
                {q.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-on-surface-variant">
                {q.reponse}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </div>
  </section>
)
export default FaqSection