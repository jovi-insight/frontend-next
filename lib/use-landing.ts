"use client";
import { useEffect, useRef, useState } from "react";
export const ETAPAS = [
  { image: "insight-captura-mobile.webp", alt: "Tela de captura da INSIGHT", label: "captura", title: "O conteúdo entra inteiro." },
  { image: "insight-organizar-mobile.webp", alt: "Organização por matéria na INSIGHT", label: "organização", title: "Cada matéria encontra seu lugar." },
  { image: "insight-resumo-mobile.webp", alt: "Resumo mobile criado pela INSIGHT", label: "síntese", title: "O essencial volta para a frente." },
  { image: "insight-quiz-mobile.webp", alt: "Quiz mobile da INSIGHT", label: "revisão ativa", title: "Aprender também é testar." },
];
export function useLanding() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [secao, setSecao] = useState("");
  const [etapa, setEtapa] = useState(0);
  const [slide, setSlide] = useState(0);
  const carrossel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fechar = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuAberto(false); };
    const redimensionar = () => { if (window.innerWidth > 900) setMenuAberto(false); };
    const rolar = () => setRolou(window.scrollY > 20);
    window.addEventListener("keydown", fechar);
    window.addEventListener("resize", redimensionar);
    window.addEventListener("scroll", rolar, { passive: true });
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(item => item.isIntersecting);
      if (entry) setSecao(entry.target.id);
    }, { rootMargin: "-38% 0px -52%" });
    document.querySelectorAll("main section[id]").forEach(section => observer.observe(section));
    return () => { observer.disconnect(); window.removeEventListener("keydown", fechar); window.removeEventListener("resize", redimensionar); window.removeEventListener("scroll", rolar); };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("menu-open", menuAberto);
    return () => document.body.classList.remove("menu-open");
  }, [menuAberto]);
  function irParaSlide(index: number) {
    const alvo = Math.max(0, Math.min(index, 2));
    const track = carrossel.current;
    const item = track?.children[alvo] as HTMLElement | undefined;
    if (item && track) {
      track.scrollTo({ left: item.offsetLeft - (track.children[0] as HTMLElement).offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      setSlide(alvo);
    }
  }
  function atualizarSlide() {
    const track = carrossel.current;
    if (!track) return;
    const first = (track.children[0] as HTMLElement).offsetLeft;
    const distances = Array.from(track.children).map(item => Math.abs((item as HTMLElement).offsetLeft - first - track.scrollLeft));
    setSlide(distances.indexOf(Math.min(...distances)));
  }
  return { menuAberto, setMenuAberto, rolou, secao, etapa, setEtapa, slide, carrossel, irParaSlide, atualizarSlide };
}
