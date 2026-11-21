import { useEffect, useState } from 'react'
import type { AgentBlock, Agents, Facts, Flag, Lang, Line, Ward } from './types'
import { day, designRules, devilsAdvocate, disagreements, pains, portalGaps, toolLessons } from './research'
import './ward-officer.css'

const T = {
  en: {
    pick: 'Your ward', budget: 'Budget', spent: 'Spent', shp: 'Should not have come from BMC', crews: 'Crews / day', flood: 'Flood risk',
    tabs: ['Today', 'Who should have paid', 'Fixed or just closed?', 'Lost complaints', 'Next rupee', 'Contractors', 'Why this'],
    today: "Today's 5 actions", asOf: 'Data as of 10 Oct 2025 (event dataset)', verify: 'Verify first', copyAll: 'Copy for WhatsApp',
    repeatsH: 'Marked resolved, then a new complaint at the same spot (within 50 m, 1 to 30 days later)',
    morning: 'Morning brief', corp: 'Reply to corporator', copy: 'Copy', copied: 'Copied',
    qc1: 'Evidence checked', qc2: 'Fairness checked', ctx: 'Needs context', held: 'lines held back: they cited an ID or ₹ figure that is not in the data',
    synthetic: 'Sample data from the Claude Impact Lab event. Not real BMC data. AI text is a draft: check before you send.',
    worth: 'Worth checking (not in total)', types: { warranty: 'Road under warranty', overbill: 'Over the rate card', double: 'Billed twice', utility: 'Utility trench' },
    loading: 'Loading…', noAgent: 'Agent notes not generated yet. Numbers below come straight from the data.',
    misfiled: 'Photo shows a pothole, filed as something else', bounced: 'Pothole complaints bounced or closed', open: 'Oldest still open',
    contractorNote: 'Read with context: heavy-rain share and flood risk change what a fair reopen rate looks like.',
    cols: ['Contractor', 'Jobs', 'Failed in 30 days', 'Missed deadline', 'Cost vs rate', 'Heavy-rain jobs'],
  },
  mr: {
    pick: 'तुमचा वॉर्ड', budget: 'बजेट', spent: 'खर्च', shp: 'BMC ने भरायला नको होते', crews: 'रोजची पथके', flood: 'पूर धोका',
    tabs: ['आज', 'कोणी भरायला हवे होते', 'खरंच दुरुस्त?', 'हरवलेल्या तक्रारी', 'पुढचा रुपया', 'कंत्राटदार', 'का?'],
    today: 'आजची 5 कामे', asOf: 'डेटा 10 ऑक्टो 2025 पर्यंतचा (इव्हेंट डेटासेट)', verify: 'आधी तपासा', copyAll: 'WhatsApp साठी कॉपी',
    repeatsH: 'सोडवली म्हणून बंद, नंतर त्याच जागी नवी तक्रार (50 मी. आत, 1 ते 30 दिवसांत)',
    morning: 'सकाळचा आढावा', corp: 'नगरसेवकांना उत्तर', copy: 'कॉपी', copied: 'कॉपी झाले',
    qc1: 'पुरावा तपासला', qc2: 'न्याय्यता तपासली', ctx: 'संदर्भ हवा', held: 'ओळी रोखल्या: त्यात डेटामध्ये नसलेला ID किंवा ₹ आकडा होता',
    synthetic: 'Claude Impact Lab मधील नमुना डेटा. खरा BMC डेटा नाही. AI मजकूर हा मसुदा आहे: पाठवण्यापूर्वी तपासा.',
    worth: 'तपासण्यासारखे (एकूणात नाही)', types: { warranty: 'हमी कालावधीतील रस्ता', overbill: 'दरपत्रकापेक्षा जास्त', double: 'दोनदा बिल', utility: 'युटिलिटी खोदकाम' },
    loading: 'लोड होत आहे…', noAgent: 'एजंटच्या नोंदी अजून तयार नाहीत. खालील आकडे थेट डेटामधून आहेत.',
    misfiled: 'फोटोत खड्डा, पण दुसऱ्या प्रकारात नोंद', bounced: 'परत पाठवलेल्या / बंद केलेल्या खड्डा तक्रारी', open: 'सर्वात जुन्या उघड्या तक्रारी',
    contractorNote: 'संदर्भासह वाचा: मुसळधार पावसातील कामे आणि पूर धोका यामुळे योग्य अपयश दर बदलतो.',
    cols: ['कंत्राटदार', 'कामे', '30 दिवसांत अपयशी', 'मुदत चुकली', 'दराच्या तुलनेत खर्च', 'मुसळधार पावसातील कामे'],
  },
}

// Indian money format: ₹4.2 L, ₹1.3 Cr.
const inr = (lang: Lang, n: number) =>
  Math.abs(n) >= 1e7 ? `₹${(n / 1e7).toFixed(2)} ${lang === "mr" ? "कोटी" : "Cr"}` : Math.abs(n) >= 1e5 ? `₹${(n / 1e5).toFixed(1)} ${lang === "mr" ? "लाख" : "L"}` : `₹${Math.round(n).toLocaleString('en-IN')}`
// Today's 5 actions: built in code from the facts, so every ID and ₹ figure is real.
function todayActions(w: Ward, lang: Lang): string[] {
  const mr = lang === 'mr'
  const out: string[] = []
  const war = w.flags.find((f) => f.type === 'warranty')
  if (war) out.push(mr
    ? `${war.roadName} (${war.road}) हमी कालावधीत आहे: मूळ रस्ता कंत्राटदाराने मोफत दुरुस्ती करायला हवी. ${war.wo} वर ${war.contractor} ला ${inr(lang, war.amount)} दिले: हमी अटी तपासा व मूळ कंत्राटदाराकडून वसूल करा.`
    : `${war.roadName} (${war.road}) is under warranty: the original road contractor should repair it free, yet ${war.wo} paid ${war.contractor} ${inr(lang, war.amount)}. Check the warranty terms and claim from the original contractor.`)
  const bill = w.flags.find((f) => f.type === 'overbill' || f.type === 'double')
  if (bill) out.push(mr
    ? `${bill.wo} चे पेमेंट तपासा: ${bill.type === 'double' ? `${bill.twin} सारखेच काम 7 दिवसांत पुन्हा` : `दरपत्रकाच्या ${bill.ratio}x`}. ${inr(lang, bill.amount)} वसूल करता येतील.`
    : `Check payment on ${bill.wo}: ${bill.type === 'double' ? `same job as ${bill.twin} within 7 days` : `billed ${bill.ratio}x the rate card`}. ${inr(lang, bill.amount)} to recover.`)
  const rep = w.repeats.examples[0]
  if (rep) out.push(mr
    ? `${rep.locality} येथे पुन्हा पाहणी करा: ${rep.closed} बंद झाल्यावर ${rep.days} दिवसांत त्याच जागी ${rep.again} आली.`
    : `Re-inspect ${rep.locality}: ${rep.again} came in ${rep.days} days after ${rep.closed} was closed, at the same spot.`)
  const lost = w.complaints.misfiledExamples[0]
  if (lost) out.push(mr
    ? `${lost.id} खड्डा म्हणून पुन्हा नोंदवा (फोटोत खड्डा, नोंद "${lost.category}").`
    : `Refile ${lost.id} as a pothole (photo shows one, filed as "${lost.category}").`)
  const road = w.nextRupee[0]
  if (road) out.push(mr
    ? `पथक ${road.name} (${road.road}) वर पाठवा: ${road.method}, अंदाजे ${road.underWarranty ? '₹0' : inr(lang, road.estCost)}.`
    : `Send a crew to ${road.name} (${road.road}): ${road.method}, about ${road.underWarranty ? '₹0' : inr(lang, road.estCost)}.`)
  return out.slice(0, 5)
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const base = import.meta.env.BASE_URL

function Badges({ l, lang }: { l: Line; lang: Lang }) {
  const t = T[lang]
  return (
    <span className="wd-badges">
      <span className="wd-qc ok" title="QC1">✓ {t.qc1}</span>
      {l.qc2 === 'needs context' ? (
        <span className="wd-qc warn" title={l.qc2Reason}>⚠ {t.ctx}</span>
      ) : (
        <span className="wd-qc ok" title={l.qc2Reason ?? 'QC2'}>✓ {t.qc2}{l.qc2 === 'reworded' ? ' *' : ''}</span>
      )}
    </span>
  )
}

function AgentText({ l, lang }: { l?: Line; lang: Lang }) {
  if (!l || !l.qc1) return null
  return (
    <p className="wd-agent">
      {l[lang]} <Badges l={l} lang={lang} />
    </p>
  )
}

// One card per work order: a job can be flagged several ways (e.g. warranty road and over the rate card).
function byWorkOrder(flags: Flag[]): Flag[][] {
  const m = new Map<string, Flag[]>()
  for (const f of flags) m.set(f.wo, [...(m.get(f.wo) ?? []), f])
  return [...m.values()]
}

const lineFor =(b: AgentBlock | undefined, key: string) => b?.items.find((i) => i.key === key && i.qc1)

export default function WardDesk() {
  const [facts, setFacts] = useState<Facts | null>(null)
  const [agents, setAgents] = useState<Agents | null>(null)
  const [code, setCode] = useState(() => localStorage.getItem('wd-ward') ?? 'F/N')
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('wd-lang') as Lang) ?? 'en')
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${base}ward-officer/facts.json`).then((r) => r.json()).then(setFacts)
    fetch(`${base}ward-officer/agents.json`).then((r) => (r.ok ? r.json() : null)).then(setAgents).catch(() => setAgents(null))
  }, [])
  useEffect(() => localStorage.setItem('wd-ward', code), [code])
  useEffect(() => localStorage.setItem('wd-lang', lang), [lang])

  const t = T[lang]
  if (!facts) return <p className="placeholder">{t.loading}</p>
  const w: Ward = facts.wards.find((x) => x.code === code) ?? facts.wards[0]
  const a = agents?.wards[w.code]
  const held = a ? [a.triage, a.auditor, a.planner].flatMap((b) => (b ? [b.summary, ...b.items] : [])).concat(a.brief ? [a.brief.morning, a.brief.corporator] : []).filter((l) => !l.qc1).length : 0
  const left = w.budget - w.spent

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="wd" lang={lang === 'mr' ? 'mr' : 'en'}>
      <div className="wd-top">
        <label>
          {t.pick}{' '}
          <select value={w.code} onChange={(e) => setCode(e.target.value)}>
            {facts.wards.map((x) => (
              <option key={x.code} value={x.code}>{x.code}: {x.name}</option>
            ))}
          </select>
        </label>
        <div className="wd-lang" role="group" aria-label="Language">
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          <button aria-pressed={lang === 'mr'} onClick={() => setLang('mr')}>मराठी</button>
        </div>
      </div>

      <p className="wd-note">{t.synthetic} · {t.asOf}</p>

      <div className="wd-stats">
        <div><span>{t.budget}</span><b>{inr(lang, w.budget)}</b></div>
        <div className={left < 0 ? 'bad' : ''}><span>{t.spent}</span><b>{inr(lang, w.spent)}</b><small>{pct(w.spent / w.budget)}</small></div>
        <div className="hl"><span>{t.shp}</span><b>{inr(lang, w.shouldHavePaid.total)}</b><small>{w.shouldHavePaid.workOrders} WO</small></div>
        <div><span>{t.crews}</span><b>{w.crews}</b></div>
        <div className={w.lowLying >= 0.75 ? 'bad' : ''}><span>{t.flood}</span><b>{w.lowLying}</b></div>
      </div>

      <nav className="wd-tabs" role="tablist">
        {t.tabs.map((name, i) => (
          <button key={name} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{name}</button>
        ))}
      </nav>

      {!a && <p className="wd-note">{t.noAgent}</p>}
      {held > 0 && <p className="wd-note">{held} {t.held}</p>}

      {tab === 0 && (
        <section>
          <h2>{t.today}</h2>
          <ol className="wd-actions">
            {todayActions(w, lang).map((x) => <li key={x}>{x} <span className="wd-qc warn">{t.verify}</span></li>)}
          </ol>
          <button className="wd-btn" onClick={() => copy(`${w.code} · ${t.today}\n` + todayActions(w, lang).map((x, i) => `${i + 1}. ${x}`).join('\n'))}>{copied ? t.copied : t.copyAll}</button>
          <h2>{t.morning}</h2>
          <AgentText l={a?.brief?.morning} lang={lang} />
          <h2>{t.corp}</h2>
          <AgentText l={a?.brief?.corporator} lang={lang} />
          {a?.brief?.corporator.qc1 && (
            <button className="wd-btn" onClick={() => copy(a.brief!.corporator[lang])}>{copied ? t.copied : t.copy}</button>
          )}
        </section>
      )}

      {tab === 2 && (
        <section>
          <h2>{t.repeatsH}: {w.repeats.count}</h2>
          <ul className="wd-list">
            {w.repeats.examples.map((r) => (
              <li key={r.closed + r.again}>
                <div className="wd-row"><b>{r.closed} → {r.again}</b><span className="wd-tag">{r.days} d</span></div>
                <small>{r.locality} · closed {r.closedAt} · new {r.againAt}</small>
                <p className="wd-quote">“{r.text}”</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 1 && (
        <section>
          <AgentText l={a?.auditor?.summary} lang={lang} />
          <div className="wd-chips">
            {Object.entries(w.shouldHavePaid.byType).map(([k, v]) => (
              <span key={k} className={k === 'utility' ? 'muted' : ''}>
                {t.types[k as keyof typeof t.types]}: {v.count} · {inr(lang, v.amount)}{k === 'utility' ? ` (${t.worth})` : ''}
              </span>
            ))}
          </div>
          <ul className="wd-list">
            {byWorkOrder(w.flags).slice(0, 25).map((fs) => {
              const f = fs[0]
              // Headline amount ignores the utility "worth checking" flag unless it is the only one.
              const counted = fs.filter((x) => x.type !== 'utility')
              const amount = Math.max(...(counted.length ? counted : fs).map((x) => x.amount))
              return (
                <li key={f.wo}>
                  <div className="wd-row">
                    <b>{f.wo}</b>
                    {fs.map((x) => <span key={x.type} className={`wd-tag ${x.type}`}>{t.types[x.type]} · {inr(lang, x.amount)}</span>)}
                    <span className="wd-amt">{inr(lang, amount)}</span>
                  </div>
                  <small>{f.roadName} ({f.road}) · {f.contractor} · {f.method} · {f.date}{f.heavyRainWeek ? ' · 🌧' : ''}</small>
                  <AgentText l={lineFor(a?.auditor, f.wo)} lang={lang} />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {tab === 3 && (
        <section>
          <AgentText l={a?.triage?.summary} lang={lang} />
          {([
            [t.misfiled, w.complaints.misfiled, w.complaints.misfiledExamples],
            [t.bounced, w.complaints.bounced, w.complaints.bouncedExamples],
            [t.open, w.complaints.open, w.complaints.oldestOpen],
          ] as const).map(([title, n, list]) => (
            <div key={title}>
              <h2>{title}: {n}</h2>
              <ul className="wd-list">
                {list.map((c) => {
                  const ai = lineFor(a?.triage, c.id)
                  return (
                    <li key={c.id}>
                      <div className="wd-row">
                        <b>{c.id}</b>
                        <span className="wd-tag">{c.status}</span>
                        {ai?.action && <span className="wd-tag act">{ai.action}</span>}
                      </div>
                      <small>{c.at} · {c.channel} · {c.locality} · {c.category}</small>
                      <p className="wd-quote">“{c.text}”</p>
                      <small>📷 {c.photo}</small>
                      <AgentText l={ai} lang={lang} />
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {tab === 4 && (
        <section>
          <AgentText l={a?.planner?.summary} lang={lang} />
          <ol className="wd-list">
            {w.nextRupee.slice(0, 5).map((r) => (
              <li key={r.road}>
                <div className="wd-row">
                  <b>{r.name} #{r.segment}</b>
                  <span className="wd-tag">{r.road}</span>
                  <span className="wd-amt">{r.underWarranty ? '₹0' : inr(lang, r.estCost)}</span>
                </div>
                <small>
                  {r.method} · {r.reopens}× reopened · {r.accidents} accidents{r.fatal ? ` (${r.fatal} fatal)` : ''}
                  {r.hospitals.length ? ` · 🏥 ${r.hospitals.join(', ')}` : ''}{r.floodSpots.length ? ` · 🌊 ${r.floodSpots.join(', ')}` : ''}
                  {r.busRoute ? ' · 🚌' : ''} · {inr(lang, r.spent)} spent so far
                </small>
                <AgentText l={lineFor(a?.planner, r.road)} lang={lang} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {tab === 5 && (
        <section>
          <p className="wd-note">{t.contractorNote}</p>
          <div className="wd-table-wrap">
            <table className="wd-table">
              <thead><tr>{t.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {w.contractors.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td><td>{c.jobs}</td><td>{pct(c.reopenRate)}</td><td>{pct(c.slaMissRate)}</td>
                    <td className={c.avgCostVsRate && c.avgCostVsRate > 1.3 ? 'bad' : ''}>{c.avgCostVsRate ?? '–'}×</td><td>{pct(c.heavyRainShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>Ward reopen rate {pct(w.reopenRate)} · missed deadline {pct(w.slaMissRate)} · {w.jobs} jobs</small>
        </section>
      )}

      {tab === 6 && (
        <section className="wd-research">
          <h2>A ward officer's day</h2>
          <ul>{day.map((d) => <li key={d.when}><b>{d.when}:</b> {d.what}</li>)}</ul>
          <h2>What hurts, and who says so</h2>
          <ul>{pains.map((p) => <li key={p.pain}>{p.pain} <small>[{p.side.join(', ')}] <a href={p.source} target="_blank" rel="noreferrer">source</a></small></li>)}</ul>
          <h2>Where the sides disagree</h2>
          <ul>{disagreements.map((d) => <li key={d.topic}><b>{d.topic}:</b> {d.a} <i>vs</i> {d.b}</li>)}</ul>
          <h2>Why civic tools die</h2>
          <ul>{toolLessons.map((x) => <li key={x}>{x}</li>)}</ul>
          <h2>What every portal misses</h2>
          <ul>{portalGaps.map((x) => <li key={x}>{x}</li>)}</ul>
          <h2>Devil's advocate</h2>
          <ul>{devilsAdvocate.map((d) => <li key={d.attack}><b>{d.attack}</b> {d.answer}</li>)}</ul>
          <h2>So this desk</h2>
          <ul>{designRules.map((x) => <li key={x}>{x}</li>)}</ul>
          <h2>How the AI is checked</h2>
          <ul>
            <li>4 agents pre-run: Triage (Sonnet), Auditor (Opus), Next-rupee planner (Sonnet), Brief writer (Sonnet). All ₹ maths is done in code, not by AI.</li>
            <li>QC1 Evidence (code): every ID and ₹ figure must exist in the data, or the line is held back.{agents ? ` ${agents.stats.qc1Pass} passed, ${agents.stats.qc1Fail} held back.` : ''}</li>
            <li>QC2 Fairness (Opus): rewrites blame that ignores rain, flood risk, crews or road owner.{agents ? ` ${agents.stats.qc2Reworded} reworded, ${agents.stats.qc2Context} marked "needs context".` : ''}</li>
          </ul>
        </section>
      )}
    </div>
  )
}
