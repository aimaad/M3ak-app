import { defaultEditableTemplate } from '../default-template';
import { parseTemplate, type Block } from '../template';
import { addBlock, addRow, moveBlock, moveRow, newBlock, pruneEmptyBoxes, removeBlock, removeRow, updateBlock, updateRow, ADDABLE_BLOCKS } from '../template-edit';

const t = defaultEditableTemplate();
const boxIndex = t.blocks.findIndex((b) => b.type === 'box');
type Box = Extract<Block, { type: 'box' }>;

describe('éditeur de modèle', () => {
  it('le modèle standard modifiable est valide et ne fige aucune valeur propre à une agence', () => {
    expect(parseTemplate(t)).not.toBeNull();
    const text = JSON.stringify(t);
    expect(text).toContain('{{caution}}');
    expect(text).toContain('{{agence_nom}}');
    expect(text).not.toMatch(/\d[\d  ]* MAD/); // aucun montant en dur
  });

  it('supprime, déplace et ajoute des blocs', () => {
    const n = t.blocks.length;
    expect(removeBlock(t, 0).blocks).toHaveLength(n - 1);
    const moved = moveBlock(t, 1, 1);
    expect(moved.blocks[2]).toEqual(t.blocks[1]);
    expect(moveBlock(t, 0, -1)).toBe(t);
    const added = addBlock(t, 'paragraph');
    expect(added.blocks).toHaveLength(n + 1);
  });

  it('garde la zone de signatures en bas quand elle est le dernier bloc', () => {
    const simple = parseTemplate({ blocks: [{ type: 'paragraph', text: 'a' }, { type: 'signatures', boxes: [{ role: 'client', label: 'x' }] }] })!;
    const out = addBlock(simple, 'rule');
    expect(out.blocks.map((b) => b.type)).toEqual(['paragraph', 'rule', 'signatures']);
  });

  it('ajoute, renomme, déplace et supprime un champ dans un cadre', () => {
    const box = t.blocks[boxIndex] as Box;
    const rows = box.rows.length;
    const added = addRow(box);
    expect(added.rows).toHaveLength(rows + 1);
    expect(updateRow(added, rows, { label: 'Numéro de dossier', value: '{{numero}}' }).rows[rows]).toMatchObject({ label: 'Numéro de dossier', value: '{{numero}}' });
    expect(removeRow(added, 0).rows).toHaveLength(rows);
    expect(moveRow(box, 1, -1).rows[0]).toEqual(box.rows[1]);
    const next = updateBlock(t, boxIndex, addRow(box));
    expect(parseTemplate(next)).not.toBeNull();
  });

  it('chaque bloc ajoutable est valide', () => {
    for (const type of ADDABLE_BLOCKS) {
      expect(parseTemplate({ blocks: [newBlock(type)] })).not.toBeNull();
    }
  });

  it('retire les cadres entièrement vidés avant enregistrement', () => {
    const emptied = updateBlock(t, boxIndex, { ...(t.blocks[boxIndex] as Box), rows: [], text: undefined });
    expect(pruneEmptyBoxes(emptied).blocks.length).toBe(t.blocks.length - 1);
  });
});
