# Progress Tab — Custom Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Progress tab in the admin dashboard show custom missions (grouped by their admin-defined categories) in addition to the built-in missions it already shows.

**Architecture:** Single frontend change inside the `tab === 'progress'` IIFE in `AdminScreen.tsx`. After computing the existing `catGroups` (built-in missions by super-category), compute `customGroups` from the already-available `adminCustomMissions` and `adminCategories` state, filtered to only missions in `activeGame.missions`. Render the custom groups between the built-in groups and the Total Score summary using the same table structure.

**Tech Stack:** React, TypeScript, Next.js 14

---

## File Map

| File | Change |
|------|--------|
| `components/screens/AdminScreen.tsx` | Extend `tab === 'progress'` block (~lines 3612–3692) to compute and render custom mission groups |

---

## Task 1: Render custom mission groups in the Progress tab

**Files:**
- Modify: `components/screens/AdminScreen.tsx` lines 3612–3692

### Background for the implementer

The file is large (~4200 lines). The relevant block starts at line 3612:
```typescript
{tab === 'progress' && (() => {
  // Group active missions by super-category
  const catGroups = ...
  return (
    <div ...>
      {catGroups.map(...)}         ← built-in category tables
      {/* Total score summary */}  ← stays at the bottom
    </div>
  );
})()}
```

State already in scope at this point:
- `adminCustomMissions: CustomMission[]` — all custom missions for this admin (loaded on mount). Each has `id: string`, `name: string`, `icon: string`, `category_id: string | null`.
- `adminCategories: AdminCategory[]` — custom categories (`id`, `name`, `emoji`, `sort_order`).
- `activeGame.missions: string[]` — all mission IDs in the game (mix of built-in and custom UUIDs).
- `sorted` — teams sorted by score, already computed above the progress block.

- [ ] **Step 1: Read the current progress tab block**

Read lines 3612–3692 in `components/screens/AdminScreen.tsx` to confirm the exact current content before editing.

- [ ] **Step 2: Replace the progress tab block**

Replace the entire `{tab === 'progress' && (() => { ... })()}` block (lines 3612–3692) with the following. The only additions are the `customGroups` computation and the `{customGroups.map(...)}` render between `{catGroups.map(...)}` and the Total Score section. Everything else is unchanged.

```tsx
        {tab === 'progress' && (() => {
          // Group active missions by super-category (built-in missions only)
          const catGroups = (Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => ({
            catKey,
            cat: SUPER_CATEGORIES[catKey],
            missions: activeGame.missions
              .map(id => MISSIONS.find(x => x.id === id))
              .filter((m): m is NonNullable<typeof m> => !!m && MISSION_SUPER_CATEGORY[m.id] === catKey),
          })).filter(g => g.missions.length > 0);

          // Group custom missions in this game by their admin category
          const customInGame = adminCustomMissions.filter(cm =>
            activeGame.missions.includes(cm.id)
          );
          const customByCatId = new Map<string | null, typeof customInGame>();
          for (const cm of customInGame) {
            const key = cm.category_id ?? null;
            if (!customByCatId.has(key)) customByCatId.set(key, []);
            customByCatId.get(key)!.push(cm);
          }
          const customGroups: { cat: AdminCategory | null; missions: typeof customInGame }[] = [];
          for (const cat of [...adminCategories].sort((a, b) => a.sort_order - b.sort_order)) {
            const missions = customByCatId.get(cat.id) ?? [];
            if (missions.length > 0) customGroups.push({ cat, missions });
          }
          const uncategorized = customByCatId.get(null) ?? [];
          if (uncategorized.length > 0) customGroups.push({ cat: null, missions: uncategorized });

          return (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Built-in mission groups */}
              {catGroups.map(({ catKey, cat, missions }) => (
                <div key={catKey}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{cat.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>{missions.length} mission{missions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ background: 'var(--card)', border: `1px solid ${cat.color}33`, borderRadius: '12px', overflow: 'auto' }}>
                    <table className="progress-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          {missions.map(m => (
                            <th key={m.id} title={m.name}>{m.icon}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.length === 0 ? (
                          <tr><td colSpan={missions.length + 1} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '12px' }}>Waiting for teams...</td></tr>
                        ) : sorted.map(t => (
                          <tr key={t.id}>
                            <td><strong>{t.name}</strong></td>
                            {missions.map(m => {
                              const done = t.completed?.includes(m.id);
                              const pts = done ? (t.mission_scores?.[m.id] ?? null) : null;
                              return (
                                <td key={m.id}>
                                  {done
                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: cat.color, fontWeight: 700, fontSize: '12px' }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                                        {pts !== null ? pts : '✓'}
                                      </span>
                                    : <span style={{ color: 'var(--muted)' }}>–</span>
                                  }
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Custom mission groups */}
              {customGroups.map(({ cat, missions }) => {
                const label = cat ? cat.name : 'Övriga';
                const emoji = cat ? cat.emoji : '📋';
                const borderColor = 'rgba(255,255,255,0.1)';
                return (
                  <div key={cat ? cat.id : '__uncategorized__'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{emoji}</span>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>{missions.length} mission{missions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ background: 'var(--card)', border: `1px solid ${borderColor}`, borderRadius: '12px', overflow: 'auto' }}>
                      <table className="progress-table">
                        <thead>
                          <tr>
                            <th>Team</th>
                            {missions.map(m => (
                              <th key={m.id} title={m.name}>{m.icon}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.length === 0 ? (
                            <tr><td colSpan={missions.length + 1} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '12px' }}>Waiting for teams...</td></tr>
                          ) : sorted.map(t => (
                            <tr key={t.id}>
                              <td><strong>{t.name}</strong></td>
                              {missions.map(m => {
                                const done = t.completed?.includes(m.id);
                                const pts = done ? (t.mission_scores?.[m.id] ?? null) : null;
                                return (
                                  <td key={m.id}>
                                    {done
                                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--muted)', fontWeight: 700, fontSize: '12px' }}>
                                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--muted)', display: 'inline-block', flexShrink: 0 }} />
                                          {pts !== null ? pts : '✓'}
                                        </span>
                                      : <span style={{ color: 'var(--muted)' }}>–</span>
                                    }
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Total score summary */}
              {sorted.length > 0 && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Total Score
                  </div>
                  <table className="progress-table">
                    <tbody>
                      {sorted.map(t => (
                        <tr key={t.id}>
                          <td><strong>{t.name}</strong></td>
                          <td className="pts-cell" style={{ textAlign: 'right' }}>{t.score} p</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Run production build**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(dashboard): show custom missions in progress tab grouped by category"
```

---

## Manual Verification

After deployment, open a game that has at least one custom mission selected. Go to the dashboard → Progress tab. Confirm:

1. Built-in missions still appear in their super-category sections (unchanged).
2. Custom missions appear below, each in a section named after their admin category (emoji + name).
3. Custom missions with no category appear under "📋 Övriga".
4. Completion dots and point values show correctly when a team completes a custom mission.
5. Games with zero custom missions: progress tab looks identical to before (no empty sections appear).
