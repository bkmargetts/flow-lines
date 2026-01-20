import { Link } from 'react-router-dom';
import './techniques.css';

interface TechniqueCard {
  id: string;
  name: string;
  description: string;
  status: 'stable' | 'experimental' | 'coming-soon';
}

const TECHNIQUES: TechniqueCard[] = [
  {
    id: 'flow-lines',
    name: 'Flow Lines',
    description: 'Generate organic line art following vector fields. Includes swarm mode, form hatching, and fill mode.',
    status: 'stable',
  },
  // Future techniques can be added here
  // {
  //   id: 'stippling',
  //   name: 'Stippling',
  //   description: 'Create images using dots of varying density.',
  //   status: 'coming-soon',
  // },
];

export function TechniquesPage() {
  return (
    <div className="techniques-page">
      <header className="techniques-header">
        <h1>Generative Art Techniques</h1>
        <p>Choose a technique to start creating pen plotter art</p>
      </header>

      <div className="techniques-grid">
        {TECHNIQUES.map((technique) => (
          <Link
            key={technique.id}
            to={`/techniques/${technique.id}`}
            className={`technique-card ${technique.status}`}
          >
            <div className="technique-preview">
              {/* Placeholder for technique preview image */}
              <div className="preview-placeholder" />
            </div>
            <div className="technique-info">
              <h2>{technique.name}</h2>
              <p>{technique.description}</p>
              <span className={`status-badge ${technique.status}`}>
                {technique.status === 'stable' ? 'Ready' :
                 technique.status === 'experimental' ? 'Experimental' : 'Coming Soon'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
