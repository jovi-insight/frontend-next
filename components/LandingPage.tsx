/* eslint-disable @next/next/no-img-element -- Preserva as imagens e dimensões da Sprint 03. */
"use client";
import { ETAPAS, useLanding } from "@/lib/use-landing";
export default function LandingPage() {
 const { menuAberto, setMenuAberto, rolou, secao, etapa, setEtapa, slide, carrossel, irParaSlide, atualizarSlide } = useLanding();
 return <>

    <a className="skip-link" href="#conteudo" aria-current={secao === "conteudo" ? "location" : undefined}>Pular para o conteúdo</a>

    <header data-header="" className={`site-header${rolou ? " is-scrolled" : ""}`}>
      <div className="shell nav-shell">
        <a className="brand insight-brand" href="#inicio" aria-label="INSIGHT — voltar ao início" aria-current={secao === "inicio" ? "location" : undefined}>INSIGHT</a>

        <button className="menu-toggle" type="button" aria-controls="menu-principal" data-menu-toggle="" aria-expanded={menuAberto} aria-label={menuAberto ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuAberto(!menuAberto)}>
          <span></span><span></span>
        </button>

        <nav id="menu-principal" aria-label="Navegação principal" data-menu="" className={`main-nav${menuAberto ? " is-open" : ""}`} onClick={() => setMenuAberto(false)}>
          <a href="#como-funciona" aria-current={secao === "como-funciona" ? "location" : undefined}>A Solução</a>
          <a href="#publico-alvo" aria-current={secao === "publico-alvo" ? "location" : undefined}>Público-Alvo</a>
          <a href="#galeria" aria-current={secao === "galeria" ? "location" : undefined}>Galeria</a>
          <a href="#equipe" aria-current={secao === "equipe" ? "location" : undefined}>Nossa Equipe</a>
          <a href="#contato" aria-current={secao === "contato" ? "location" : undefined}>Contato</a>
        </nav>

        <a className="nav-action" href="/login" aria-current={secao === "contato" ? "location" : undefined}>
          <span className="signal-dot" aria-hidden="true"></span>
          Acessar aplicativo
        </a>
      </div>
    </header>

    <main id="conteudo">
      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <h1 id="hero-title">
              <span className="hero-promise">Da aula para o conteúdo que <em>realmente fica.</em></span>
            </h1>
            <p className="hero-lead">
              Capture quadros, cadernos e explicações. A INSIGHT organiza o material e o devolve em formatos claros, ativos e acessíveis.
            </p>
            <div className="hero-actions flex flex-wrap gap-4">
              <a className="button button-primary" href="#como-funciona" aria-current={secao === "como-funciona" ? "location" : undefined}>
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8M12 8v8"></path></svg>
                Acessar aplicativo
                <span className="button-signal" aria-hidden="true"></span>
              </a>
              <a className="text-action" href="#prototipo" aria-current={secao === "prototipo" ? "location" : undefined}>Assistir à apresentação <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"></path></svg></a>
            </div>
          </div>

          <div className="hero-composition" aria-label="A INSIGHT funcionando em um JOVI V70">
            <div className="hero-device-meta" aria-hidden="true"><span>INSIGHT SCAN</span><span>JOVI V70</span></div>
            <figure className="hero-phone jovi-device">
              <img className="jovi-product" src="/landing/assets/campaign/jovi-v70/v70-device-sapphire.png" alt="" width="640" height="640" aria-hidden="true" />
              <div className="jovi-screen"><img src="/landing/assets/screenshots/insight-captura-mobile.webp" alt="Tela SCAN da INSIGHT capturando uma anotação de Matemática no JOVI V70" width="390" height="844" /></div>
            </figure>
          </div>
        </div>
      </section>

      <section className="transformation" id="como-funciona" aria-labelledby="flow-title">
        <div className="shell flow-head">
          <h2 id="flow-title">Uma foto não deveria terminar esquecida na galeria.</h2>
          <p>O mesmo material atravessa um fluxo contínuo: entra como registro, ganha contexto e volta pronto para revisão.</p>
        </div>

        <div className="shell flow-layout" data-flow="">
          <div className="flow-stage" aria-live="polite">
            <div className="flow-source" aria-hidden="true">
              <img src="/landing/assets/learning/matematica-caderno.webp" alt="" width="900" height="1120" />
            </div>
            <figure className="flow-phone jovi-device">
              <img className="jovi-product" src="/landing/assets/campaign/jovi-v70/v70-device-sapphire.png" alt="" width="640" height="640" aria-hidden="true" />
              <div className="jovi-screen"><img data-flow-image="" width="390" height="844" src={`/landing/assets/screenshots/${ETAPAS[etapa].image}`} alt={ETAPAS[etapa].alt} /></div>
            </figure>
            <div className="flow-output" aria-hidden="true">
              <small data-flow-label="">{ETAPAS[etapa].label}</small>
              <strong data-flow-title="">{ETAPAS[etapa].title}</strong>
            </div>
          </div>

          <ol className="flow-steps">
            <li>
              <button type="button" data-screen="/landing/assets/screenshots/insight-captura-mobile.webp" data-alt="Tela de captura da INSIGHT" data-label="captura" data-title="O conteúdo entra inteiro." className={`flow-step${etapa === 0 ? " is-active" : ""}`} aria-pressed={etapa === 0} onClick={() => setEtapa(0)}>
                <span>Capturar</span>
                <strong>Fotografe o quadro ou o caderno.</strong>
                <p>A INSIGHT reconhece o registro e prepara o material para seguir no fluxo.</p>
              </button>
            </li>
            <li>
              <button type="button" data-screen="/landing/assets/screenshots/insight-organizar-mobile.webp" data-alt="Tela da INSIGHT classificando o conteúdo" data-label="organização" data-title="Cada matéria encontra seu lugar." className={`flow-step${etapa === 1 ? " is-active" : ""}`} aria-pressed={etapa === 1} onClick={() => setEtapa(1)}>
                <span>Organizar</span>
                <strong>Classifique sem quebrar o ritmo.</strong>
                <p>O conteúdo é confirmado e guardado por matéria para continuar consultável.</p>
              </button>
            </li>
            <li>
              <button type="button" data-screen="/landing/assets/screenshots/insight-resumo-mobile.webp" data-alt="Resumo mobile criado pela INSIGHT" data-label="síntese" data-title="O essencial volta para a frente." className={`flow-step${etapa === 2 ? " is-active" : ""}`} aria-pressed={etapa === 2} onClick={() => setEtapa(2)}>
                <span>Entender</span>
                <strong>Retome os pontos principais.</strong>
                <p>Resumos e termos-chave transformam o próprio material da aula em revisão direta.</p>
              </button>
            </li>
            <li>
              <button type="button" data-screen="/landing/assets/screenshots/insight-quiz-mobile.webp" data-alt="Quiz mobile da INSIGHT" data-label="revisão ativa" data-title="Aprender também é testar." className={`flow-step${etapa === 3 ? " is-active" : ""}`} aria-pressed={etapa === 3} onClick={() => setEtapa(3)}>
                <span>Praticar</span>
                <strong>Teste o que realmente ficou.</strong>
                <p>Quizzes de múltipla escolha ajudam o estudante a recuperar e fixar o conteúdo.</p>
              </button>
            </li>
          </ol>
        </div>
      </section>

      <section className="evidence" id="galeria" aria-labelledby="evidence-title">
        <div className="shell evidence-head">
          <h2 id="evidence-title">Aula real dentro do produto.</h2>
          <div className="evidence-controls" role="group" aria-label="Navegar pelos exemplos de matérias">
            <span data-carousel-status="" aria-live="polite">{String(slide + 1).padStart(2, "0")} / 03</span>
            <button type="button" data-carousel-prev="" aria-label="Matéria anterior" onClick={() => irParaSlide(slide - 1)} disabled={slide === 0}>
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"></path></svg>
            </button>
            <button type="button" data-carousel-next="" aria-label="Próxima matéria" onClick={() => irParaSlide(slide + 1)} disabled={slide === 2}>
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>
            </button>
          </div>
        </div>

        <div className="evidence-track" data-carousel="" data-carousel-track="" tabIndex={0} aria-roledescription="carrossel" ref={carrossel} onScroll={atualizarSlide} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); irParaSlide(slide + (event.key === "ArrowRight" ? 1 : -1)); } }}>
          <figure className="evidence-item evidence-wide" data-carousel-slide="">
            <img src="/landing/assets/learning/historia-sala.webp" alt="Sala de aula real com quadro sobre Cultura e Egito Antigo" width="1400" height="900" loading="lazy" />
            <figcaption><span>História</span><strong>O quadro deixa de ser uma foto solta.</strong></figcaption>
          </figure>
          <figure className="evidence-item evidence-tall" data-carousel-slide="">
            <img src="/landing/assets/learning/matematica-caderno.webp" alt="Caderno real com gráficos de função de primeiro grau" width="900" height="1120" loading="lazy" />
            <figcaption><span>Matemática</span><strong>A anotação atravessa captura, resumo e quiz.</strong></figcaption>
          </figure>
          <figure className="evidence-item evidence-wide" data-carousel-slide="">
            <img src="/landing/assets/learning/quimica-aula.webp" alt="Aula real de Química diante de estudantes" width="1200" height="900" loading="lazy" />
            <figcaption><span>Química</span><strong>Conteúdo denso ganha um caminho de revisão.</strong></figcaption>
          </figure>
        </div>
      </section>

      <section className="prototype" id="prototipo" aria-labelledby="prototype-title">
        <div className="shell prototype-head">
          <h2 id="prototype-title">Veja o fluxo acontecer.</h2>
          <p>Da captura do caderno à biblioteca, ao resumo e ao quiz — usando as telas reais do protótipo.</p>
        </div>

        <div className="shell video-stage">
          <video controls loop muted playsInline preload="metadata" poster="/landing/assets/videos/insight-whatsapp-poster.jpg" aria-label="Vídeo da campanha INSIGHT no JOVI V70">
            <source src="/landing/assets/videos/video.mp4" type="video/mp4" />
            Seu navegador não suporta a reprodução de vídeo.
          </video>
        </div>

        <div className="shell prototype-rail">
          <div>
            <h3>Uma experiência, seis momentos reais.</h3>
            <p>Captura, organização, biblioteca, resumo, quiz e perfis acessíveis fazem parte do mesmo percurso.</p>
          </div>
          <div className="screen-stack" aria-label="Telas do protótipo INSIGHT">
            <figure className="jovi-device"><img className="jovi-product" src="/landing/assets/campaign/jovi-v70/v70-device-sapphire.png" alt="" width="640" height="640" aria-hidden="true" loading="lazy" /><div className="jovi-screen"><img src="/landing/assets/screenshots/insight-biblioteca-mobile.webp" alt="Biblioteca mobile da INSIGHT no JOVI V70" width="390" height="844" loading="lazy" /></div></figure>
            <figure className="jovi-device"><img className="jovi-product" src="/landing/assets/campaign/jovi-v70/v70-device-lilac.png" alt="" width="640" height="640" aria-hidden="true" loading="lazy" /><div className="jovi-screen"><img src="/landing/assets/screenshots/insight-resumo-mobile.webp" alt="Resumo mobile da INSIGHT no JOVI V70" width="390" height="844" loading="lazy" /></div></figure>
            <figure className="jovi-device"><img className="jovi-product" src="/landing/assets/campaign/jovi-v70/v70-device-sapphire.png" alt="" width="640" height="640" aria-hidden="true" loading="lazy" /><div className="jovi-screen"><img src="/landing/assets/screenshots/insight-quiz-mobile.webp" alt="Quiz mobile da INSIGHT no JOVI V70" width="390" height="844" loading="lazy" /></div></figure>
          </div>
        </div>
      </section>

      <section className="accessibility" id="acessibilidade" aria-labelledby="accessibility-title">
        <div className="shell access-layout">
          <div className="access-copy">
            <h2 id="accessibility-title">Acessibilidade não entra depois. Ela atravessa o produto.</h2>
            <p>Libras pela câmera, legendas, narração, contraste e perfis visuais fazem parte da arquitetura da INSIGHT.</p>
            <ul>
              <li><strong>Libras</strong><span>Reconhecimento do alfabeto manual pela câmera.</span></li>
              <li><strong>Legendas</strong><span>Conteúdo audiovisual em mais de um formato.</span></li>
              <li><strong>Narração</strong><span>Resumos e quizzes também em áudio.</span></li>
              <li><strong>Perfis adaptáveis</strong><span>Contraste e ajustes para baixa visão, dislexia e TDAH.</span></li>
            </ul>
          </div>

          <div className="access-composition">
            <div className="access-keywords" aria-hidden="true">
              <span>VISUAL</span><span>ÁUDIO</span><span>LEGENDA</span><span>CONTRASTE</span>
            </div>
            <figure className="access-phone jovi-device">
              <img className="jovi-product" src="/landing/assets/campaign/jovi-v70/v70-device-lilac.png" alt="" width="640" height="640" aria-hidden="true" />
              <div className="jovi-screen"><img src="/landing/assets/screenshots/insight-acessibilidade-mobile.webp" alt="Tela mobile de perfis de acessibilidade da INSIGHT no JOVI V70" width="390" height="844" /></div>
            </figure>
          </div>
        </div>
      </section>

      <section className="audience" id="publico-alvo" aria-labelledby="audience-title">
        <div className="shell audience-layout">
          <h2 id="audience-title">Feita para quem aprende de muitos jeitos.</h2>
          <div className="audience-list">
            <article><h3>Estudantes</h3><p>Mais organização e autonomia para revisar a própria aula.</p></article>
            <article><h3>Estudantes surdos</h3><p>Uma experiência visual com Libras, legendas e diferentes formatos.</p></article>
            <article><h3>Educadores</h3><p>Materiais mais fáceis de consultar em diferentes ritmos.</p></article>
            <article><h3>Instituições</h3><p>Inovação educacional com inclusão e foco no estudante.</p></article>
          </div>
        </div>
      </section>

      <section className="team" id="equipe" aria-labelledby="team-title">
        <div className="shell team-head">
          <h2 id="team-title">Cinco perspectivas. Uma entrega de ponta a ponta.</h2>
          <p>Produto, tecnologia, experiência e acessibilidade reunidos para apresentar a INSIGHT à JOVI.</p>
        </div>

        <div className="shell team-list" role="list">
          <article role="listitem"><div className="member-photo"><img src="/landing/assets/team/matheus-tasso.jpg" alt="Foto de Matheus Tasso Djamdjian" width="390" height="402" loading="lazy" /></div><div><h3>Matheus Tasso Djamdjian</h3></div><small>RM 570716</small></article>
          <article role="listitem"><div className="member-photo"><img src="/landing/assets/team/guilherme-vidichosqui.jpg" alt="Foto de Guilherme Vidichosqui Men" width="390" height="402" loading="lazy" /></div><div><h3>Guilherme Vidichosqui Men</h3></div><small>RM 570269</small></article>
          <article role="listitem"><div className="member-photo"><img src="/landing/assets/team/gustavo-teotonio.jpg" alt="Foto de Gustavo Teotonio Silva" width="387" height="402" loading="lazy" /></div><div><h3>Gustavo Teotonio Silva</h3></div><small>RM 572803</small></article>
          <article role="listitem"><div className="member-photo"><img src="/landing/assets/team/alisson-gomes.jpg" alt="Foto de Alisson Gomes Pereira" width="384" height="402" loading="lazy" /></div><div><h3>Alisson Gomes Pereira</h3></div><small>RM 573681</small></article>
          <article role="listitem"><div className="member-photo"><img src="/landing/assets/team/victor-kenji.jpg" alt="Foto de Vitor Kenji Kawaguchi Iwagoe Indiani" width="390" height="402" loading="lazy" /></div><div><h3>Vitor Kenji Kawaguchi Iwagoe Indiani</h3></div><small>RM 569329</small></article>
        </div>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <div className="shell closing-layout">
          <h2 id="closing-title">A aula acaba.<br />O aprendizado continua.</h2>
          <div>
            <p>INSIGHT transforma registros dispersos em uma rotina de estudo contínua, ativa e inclusiva.</p>
            <a className="button button-primary" href="https://github.com/jovi-insight" target="_blank" rel="noopener noreferrer">
              Conhecer o projeto no GitHub
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"></path></svg>
            </a>
          </div>
        </div>
      </section>

      <section className="contact" id="contato" aria-labelledby="contact-title">
        <div className="shell contact-layout">
          <div className="contact-copy">
            <h2 id="contact-title">Vamos conversar sobre a INSIGHT.</h2>
            <p>Dúvidas, feedback ou parcerias? Fale com a equipe. Respondemos por e-mail e estamos abertos a trocar sobre o projeto.</p>

            <ul className="contact-channels">
              <li>
                <span>E-mail</span>
                <a href="mailto:joviinsightfiap@gmail.com">joviinsightfiap@gmail.com</a>
              </li>
              <li>
                <span>Projeto</span>
                <a href="https://github.com/jovi-insight" target="_blank" rel="noopener noreferrer">github.com/jovi-insight</a>
              </li>
            </ul>

            <div className="contact-social" aria-label="Redes sociais da equipe">
              <a href="https://github.com/jovi-insight" target="_blank" rel="noopener noreferrer" aria-label="GitHub do projeto INSIGHT">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                <span>GitHub</span>
              </a>
              <a href="mailto:joviinsightfiap@gmail.com" aria-label="Enviar e-mail para a equipe INSIGHT">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 6l8 6 8-6"></path></svg>
                <span>E-mail</span>
              </a>
            </div>
          </div>

          <form className="contact-form" action="mailto:joviinsightfiap@gmail.com" method="post" encType="text/plain" aria-labelledby="contact-title">
            <div className="field">
              <label htmlFor="contact-name">Nome</label>
              <input type="text" id="contact-name" name="nome" autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="contact-email">E-mail</label>
              <input type="email" id="contact-email" name="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="contact-message">Mensagem</label>
              <textarea id="contact-message" name="mensagem" rows={4} required></textarea>
            </div>
            <button className="button button-primary" type="submit">
              Enviar mensagem
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
            </button>
          </form>
        </div>
      </section>
    </main>

    <footer className="site-footer">
      <div className="footer-signature">
        <a className="footer-wordmark" href="#inicio" aria-label="INSIGHT — voltar ao início" aria-current={secao === "inicio" ? "location" : undefined}>
          <span aria-hidden="true">INSIGHT</span>
        </a>
      </div>
      <div className="shell footer-info">
        <p className="footer-description">INSIGHT · solução para a JOVI Challenge FIAP 2026.</p>
        <nav className="footer-nav" aria-label="Navegação do rodapé">
          <a href="#como-funciona" aria-current={secao === "como-funciona" ? "location" : undefined}>A Solução</a>
          <a href="#publico-alvo" aria-current={secao === "publico-alvo" ? "location" : undefined}>Público-Alvo</a>
          <a href="#galeria" aria-current={secao === "galeria" ? "location" : undefined}>Galeria</a>
          <a href="#equipe" aria-current={secao === "equipe" ? "location" : undefined}>Nossa Equipe</a>
          <a href="#contato" aria-current={secao === "contato" ? "location" : undefined}>Contato</a>
        </nav>

        <a className="back-to-top" href="#inicio" aria-current={secao === "inicio" ? "location" : undefined}>Voltar ao topo <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 19V5M7 10l5-5 5 5"></path></svg></a>
      </div>
    </footer>
  
</>;
}
