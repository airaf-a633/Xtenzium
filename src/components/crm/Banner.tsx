interface BannerProps {
  type: 'error' | 'success' | 'info';
  message: string;
}

const COLORS = {
  error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171' },
  success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa' },
};

const Banner = ({ type, message }: BannerProps) => {
  const c = COLORS[type];
  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 8,
      padding: '10px 14px',
      color: c.text,
      fontSize: 13.5,
      marginBottom: 16,
      lineHeight: 1.5,
    }}>
      {message}
    </div>
  );
};

export default Banner;
