// Re-export the build-time-resolved environment so feature code never has
// to know about the dev/prod swap mechanism. Angular file replacements in
// project.json point `../../environments/environment` at the right file.
export { environment as APP_ENVIRONMENT } from '../../environments/environment';
