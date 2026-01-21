# Coursify Backend

## Configuration

### Prérequis
- Node.js (version 16 ou supérieure)
- MongoDB (installé et en cours d'exécution)

### Installation

1. **Installer les dépendances :**
   ```bash
   npm install
   ```

2. **Configurer MongoDB :**
   - Assurez-vous que MongoDB est installé et en cours d'exécution
   - Par défaut, l'application se connecte à `mongodb://localhost:27017`
   - Vous pouvez modifier l'URL de connexion en définissant la variable d'environnement `MONGODB_URI`

3. **Démarrer le serveur :**
   ```bash
   npm run dev
   ```

Le serveur démarrera sur le port 5000.

## API Endpoints

### Inscription d'utilisateur
- **POST** `/api/auth/signup`
- **Body :**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "Student"
  }
  ```

### Récupérer tous les utilisateurs
- **GET** `/api/auth/users`

### Page Staff
- **GET** `/staff` - Affiche la page staff avec tous les utilisateurs

## Structure de la base de données

### Collection `users`
```json
{
  "id": "unique_id",
  "firstName": "John",
  "lastName": "Doe",
  "name": "John Doe",
  "email": "john@example.com",
  "passwordHash": "hashed_password",
  "role": "Student",
  "status": "Active",
  "contact": "",
  "joined": "22 Aug, 2025",
  "published": true,
  "createdAt": "2025-08-22T10:00:00.000Z"
}
```

## Validation des formulaires

Le formulaire d'inscription valide :
- **firstName** : Requis, minimum 2 caractères
- **lastName** : Requis, minimum 2 caractères
- **email** : Format email valide
- **password** : Minimum 8 caractères
- **role** : Requis (Student, Instructor, Admin)
- **Terms** : Doit être accepté

## Sécurité

- Les mots de passe sont hashés avec bcrypt
- Validation des données côté serveur
- Protection contre les injections MongoDB
- Exclusion des mots de passe hashés des réponses API
