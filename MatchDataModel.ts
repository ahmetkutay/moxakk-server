import mongoose from 'mongoose';

const matchDataSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  matchInput: { type: String, required: true },
  venue: { type: String, required: true },
  unavailablePlayers: {
    home: { type: [String], default: [] },
    away: { type: [String], default: [] },
  },
  recentMatches: {
    home: { type: [String], default: [] },
    away: { type: [String], default: [] },
    between: { type: [String], default: [] },
  },
  weather: {
    temperature: { type: Number, required: true },
    condition: { type: String, required: true },
    humidity: { type: Number, required: true },
    windSpeed: { type: Number, required: true },
  },
});

const MatchData = mongoose.model('MatchData', matchDataSchema);

export default MatchData;
