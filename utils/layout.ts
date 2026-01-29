
import { DesignItem, PackedDesign } from '../types';

/**
 * Packs multiple items into a sheet of fixed width, minimizing total length.
 * It calculates the best orientation for each design group based on the total 
 * length it would occupy given its quantity, ensuring the most efficient use of space.
 */
export const packDesigns = (
  items: DesignItem[],
  sheetWidth: number,
  spacing: number = 0
): { packed: PackedDesign[]; totalLength: number; totalAreaUsed: number } => {
  if (items.length === 0) return { packed: [], totalLength: 0, totalAreaUsed: 0 };

  const individualUnits: PackedDesign[] = [];

  items.forEach(item => {
    const dim1 = item.width;
    const dim2 = item.height;

    // Calculate performance for Orientation A (W=dim1, H=dim2)
    let lengthA = Infinity;
    const fitsA = dim1 <= sheetWidth;
    if (fitsA) {
      const perRow = Math.floor((sheetWidth + spacing) / (dim1 + spacing)) || 1;
      const actualPerRow = Math.min(perRow, item.quantity);
      const rows = Math.ceil(item.quantity / actualPerRow);
      lengthA = rows * dim2 + (rows - 1) * spacing;
    }

    // Calculate performance for Orientation B (W=dim2, H=dim1)
    let lengthB = Infinity;
    const fitsB = dim2 <= sheetWidth;
    if (fitsB) {
      const perRow = Math.floor((sheetWidth + spacing) / (dim2 + spacing)) || 1;
      const actualPerRow = Math.min(perRow, item.quantity);
      const rows = Math.ceil(item.quantity / actualPerRow);
      lengthB = rows * dim1 + (rows - 1) * spacing;
    }

    // Choose the orientation that results in less total length
    let finalW: number, finalH: number, rotated: boolean;

    if (lengthA <= lengthB && fitsA) {
      finalW = dim1;
      finalH = dim2;
      rotated = false;
    } else if (fitsB) {
      finalW = dim2;
      finalH = dim1;
      rotated = true;
    } else if (fitsA) {
      // Fallback if only A fits
      finalW = dim1;
      finalH = dim2;
      rotated = false;
    } else {
      // Neither fits? Force A and it will overflow (UI handles it)
      finalW = dim1;
      finalH = dim2;
      rotated = false;
    }

    for (let i = 0; i < item.quantity; i++) {
      individualUnits.push({
        ...item,
        id: `${item.id}-${i}`,
        originalId: item.id,
        x: 0,
        y: 0,
        width: finalW,
        height: finalH,
        rotated: rotated
      } as any);
    }
  });

  // Sort by height (decreasing) - Standard FFDH heuristic
  individualUnits.sort((a, b) => b.height - a.height);

  let currentX = 0;
  let currentY = 0;
  let rowMaxHeight = 0;
  let totalAreaUsed = 0;

  const packed: PackedDesign[] = [];

  individualUnits.forEach((unit, index) => {
    const w = unit.width;
    const h = unit.height;

    // Check if item fits in current row
    if (currentX + w > sheetWidth && currentX > 0) {
      // Start new row
      currentX = 0;
      currentY += rowMaxHeight + spacing;
      rowMaxHeight = 0;
    }

    unit.x = currentX;
    unit.y = currentY;

    packed.push(unit);

    currentX += w + spacing;
    rowMaxHeight = Math.max(rowMaxHeight, h);
    totalAreaUsed += w * h;
  });

  const totalLength = packed.length > 0 ? currentY + rowMaxHeight : 0;

  return {
    packed,
    totalLength,
    totalAreaUsed
  };
};
