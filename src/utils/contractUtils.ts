/**
 * Utilitaires de calcul et de vérification pour les contrats commerciaux et contrats de travail.
 * NIGER SÉCURITÉ - Niamey
 */

export function calculateContractDuration(dateDebut?: string, dateFin?: string): string {
  if (!dateDebut) return 'Date non définie';
  if (!dateFin) return 'Durée indéterminée (CDI)';

  const start = new Date(dateDebut);
  const end = new Date(dateFin);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Dates invalides';
  }

  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) {
    return 'Date de fin antérieure au début';
  }

  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays <= 1) return '1 jour';
  if (diffDays < 7) return `${diffDays} jours`;
  if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks} semaine${weeks > 1 ? 's' : ''} (${diffDays} jours)`;
  }

  const months = Math.round(diffDays / 30.44);
  if (months === 12) return '1 an (12 mois)';
  if (months > 12 && months % 12 === 0) {
    const years = months / 12;
    return `${years} an${years > 1 ? 's' : ''} (${diffDays} jours)`;
  }
  return `${months} mois (${diffDays} jours)`;
}

export interface ExpirationAlertInfo {
  estExpire: boolean;
  estEnAlerte: boolean;
  joursRestants: number;
  message: string;
}

export function checkAgentContractExpiration(dateFin?: string): ExpirationAlertInfo {
  if (!dateFin) {
    return {
      estExpire: false,
      estEnAlerte: false,
      joursRestants: 9999,
      message: 'CDI permanent (sans date de fin)',
    };
  }

  // Ref date : currently mock date is around October/November 2026
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(dateFin);
  end.setHours(0, 0, 0, 0);

  if (isNaN(end.getTime())) {
    return {
      estExpire: false,
      estEnAlerte: false,
      joursRestants: 0,
      message: 'Date d’échéance invalide',
    };
  }

  const diffDays = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      estExpire: true,
      estEnAlerte: true,
      joursRestants: diffDays,
      message: `Contrat CDD expiré depuis ${Math.abs(diffDays)} jour(s) (Échéance : ${dateFin}) - Non renouvelé automatiquement`,
    };
  }

  if (diffDays <= 45) {
    return {
      estExpire: false,
      estEnAlerte: true,
      joursRestants: diffDays,
      message: `Expire dans ${diffDays} jour(s) (Échéance : ${dateFin}) - Décision RH requise (Sans renouvellement automatique)`,
    };
  }

  return {
    estExpire: false,
    estEnAlerte: false,
    joursRestants: diffDays,
    message: `Actif jusqu'au ${dateFin} (${diffDays} jours restants)`,
  };
}
