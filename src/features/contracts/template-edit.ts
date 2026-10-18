import { LIMITS, type Block, type ContractTemplate, type FieldRow } from './template';

/** Opérations pures de l'éditeur de modèle : le propriétaire modifie, supprime, ajoute et déplace des cadres, champs et textes. */
export const ADDABLE_BLOCKS = ['heading', 'paragraph', 'box', 'vehicleDiagram', 'fuelGauge', 'rule', 'pageBreak'] as const;
export type AddableBlock = (typeof ADDABLE_BLOCKS)[number];

export function newBlock(type: AddableBlock): Block {
  switch (type) {
    case 'heading':
      return { type: 'heading', text: 'Nouveau titre', size: 'md', bold: true, border: 'bottom' };
    case 'paragraph':
      return { type: 'paragraph', text: 'Nouveau texte', size: 'sm' };
    case 'box':
      return { type: 'box', width: 'full', title: 'Nouveau cadre', rows: [{ label: 'Nouveau champ', value: '' }] };
    case 'vehicleDiagram':
      return { type: 'vehicleDiagram', title: 'État du véhicule' };
    case 'fuelGauge':
      return { type: 'fuelGauge', width: 'full', title: 'Niveau de carburant' };
    case 'rule':
      return { type: 'rule' };
    case 'pageBreak':
      return { type: 'pageBreak' };
  }
}

const withBlocks = (template: ContractTemplate, blocks: Block[]): ContractTemplate => ({ ...template, blocks });

export function updateBlock(template: ContractTemplate, index: number, block: Block): ContractTemplate {
  return withBlocks(template, template.blocks.map((current, i) => (i === index ? block : current)));
}

/** Ajoute un bloc à la fin (avant la zone de signatures s'il y en a une, pour qu'elle reste en bas). */
export function addBlock(template: ContractTemplate, type: AddableBlock): ContractTemplate {
  if (template.blocks.length >= LIMITS.blocks) return template;
  const blocks = [...template.blocks];
  const lastSignatures = blocks.map((block) => block.type).lastIndexOf('signatures');
  blocks.splice(lastSignatures >= 0 && lastSignatures === blocks.length - 1 ? lastSignatures : blocks.length, 0, newBlock(type));
  return withBlocks(template, blocks);
}

export function removeBlock(template: ContractTemplate, index: number): ContractTemplate {
  return withBlocks(template, template.blocks.filter((_, i) => i !== index));
}

export function moveBlock(template: ContractTemplate, index: number, direction: -1 | 1): ContractTemplate {
  const target = index + direction;
  if (target < 0 || target >= template.blocks.length) return template;
  const blocks = [...template.blocks];
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return withBlocks(template, blocks);
}

type RowBlock = Extract<Block, { rows: FieldRow[] }>;

export function hasRows(block: Block): block is RowBlock {
  return block.type === 'box' || block.type === 'fields';
}

export function updateRow(block: RowBlock, rowIndex: number, patch: Partial<FieldRow>): RowBlock {
  return { ...block, rows: block.rows.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row)) };
}

export function addRow(block: RowBlock, row: FieldRow = { label: 'Nouveau champ', value: '' }): RowBlock {
  return block.rows.length >= LIMITS.rows ? block : { ...block, rows: [...block.rows, row] };
}

export function removeRow(block: RowBlock, rowIndex: number): RowBlock {
  return { ...block, rows: block.rows.filter((_, i) => i !== rowIndex) };
}

export function moveRow(block: RowBlock, rowIndex: number, direction: -1 | 1): RowBlock {
  const target = rowIndex + direction;
  if (target < 0 || target >= block.rows.length) return block;
  const rows = [...block.rows];
  [rows[rowIndex], rows[target]] = [rows[target], rows[rowIndex]];
  return { ...block, rows };
}

/** Un cadre sans aucune ligne ni texte est supprimé à l'enregistrement (il serait invalide). */
export function pruneEmptyBoxes(template: ContractTemplate): ContractTemplate {
  return withBlocks(
    template,
    template.blocks.filter((block) => !(block.type === 'box' && block.rows.length === 0 && !block.text?.trim()))
  );
}
