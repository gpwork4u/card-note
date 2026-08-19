/** bottom-left usage hints (hidden on phones by the parent view) */
export function Hint() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        fontSize: 11.5,
        color: '#aaaab2',
        display: 'flex',
        gap: 14,
        pointerEvents: 'none',
      }}
    >
      <span>拖曳空白處平移</span>
      <span>拖曳卡片移動</span>
      <span>點卡片開啟</span>
      <span>拖右緣圓點到另一張卡建立連結</span>
    </div>
  );
}
