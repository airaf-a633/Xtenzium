import styles from './OrbitalStrategy.module.css';

const OrbitalStrategy = () => {
  return (
    <div className={styles.container}>
      <div className={styles.floorShadow}></div>
      
      <div className={styles.levitatingWrapper}>
        <div className={styles.rotatingRing}>
          <svg width="100%" height="100%" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
            <circle 
              cx="200" cy="200" r="180" 
              className={styles.svgCircle} 
            />
          </svg>
          
          <div 
            className={styles.orbitalNode} 
            style={{ right: '20px' }}
            title="Strategic Node"
          >
            <div className={styles.orbitalNodeCore}></div>
          </div>
        </div>

        <h2 className={styles.centerText}>XTENZIUM<br/>STRATEGY</h2>
      </div>
    </div>
  );
};

export default OrbitalStrategy;
