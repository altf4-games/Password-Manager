import "./App.css";

import CryptoJS from "crypto-js";

import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  setDoc,
  getDoc,
  doc,
  arrayUnion,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxQDo-leupv8bbzBGra_EdZ7P7on708mk",
  authDomain: "password-manager-pm.firebaseapp.com",
  projectId: "password-manager-pm",
  storageBucket: "password-manager-pm.appspot.com",
  messagingSenderId: "112193590152",
  appId: "1:112193590152:web:8494c6524247f4edffe03d",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function App() {
  const [user] = useAuthState(auth);

  return (
    <div className="App">
      <header>
        <h1>Password 🔑 Manager 👩‍💼</h1>
        <SignOut />
      </header>
      {user ? <PasswordManager /> : <SignIn />}
    </div>
  );
}

const SignIn = () => {
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  return (
    <div className="SignInPage">
      <h2>Sign In With Google</h2>
      <button className="SignInButton" onClick={signInWithGoogle}>
        Sign In
      </button>
    </div>
  );
};

const SignOut = () => {
  return (
    auth.currentUser && (
      <button className="sign-out" onClick={() => auth.signOut()}>
        Sign Out
      </button>
    )
  );
};

const PasswordManager = () => {
  const [accountExists, setAccountExists] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const checkIfAccountExists = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        setAccountExists(docSnap.exists());
      } else {
        setAccountExists(false);
      }
    };

    checkIfAccountExists();
  }, []);

  return (
    <div>
      {accountExists === null ? null : accountExists ? (
        <div>
          {loggedIn ? <Vault /> : <VaultPassword setLoggedIn={setLoggedIn} />}
        </div>
      ) : (
        <PasswordForm />
      )}
    </div>
  );
};

function VaultPassword({ setLoggedIn }) {
  const [masterPassword, setMasterPassword] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchMasterPassword = async () => {
      try {
        const master = await retrieveMasterPassword(auth.currentUser.uid);
        setMasterPassword(master);
      } catch (error) {
        console.error("Error retrieving master password:", error);
      }
    };

    fetchMasterPassword();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password === masterPassword) {
      setLoggedIn(true);
    } else {
      setErrorMessage("Password Doesn't Match!");
    }
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
  };

  return (
    <div className="SetPwd">
      <h1>ENTER VAULT PASSWORD: 🔑</h1>
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          id="pwd"
          name="pwd"
          value={password}
          onChange={handlePasswordChange}
        />
      </form>
    </div>
  );
}

const PasswordForm = () => {
  const user = auth.currentUser.uid;
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
  };

  const isStrongPassword = (password) => {
    return /^[a-zA-Z0-9!@#$%^&*()-_+=]+$/.test(password) && password.length > 8;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isStrongPassword(password)) {
      const SECRET = generateRandomSecretKey(16);
      const encrypted = encrypt(password, SECRET);

      setDoc(doc(db, "users", user), {
        master: encrypted,
        SECRET: SECRET,
      }).then(() => window.location.reload(false));
    } else {
      setErrorMessage("Password must be at least 8 characters long");
    }
  };

  return (
    <div className="SetPwd">
      <h1>SET MASTER PASSWORD: 🔑</h1>
      <p>
        This password can't be changed later and would be required to access
        your vault
      </p>
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          id="pwd"
          name="pwd"
          value={password}
          onChange={handlePasswordChange}
        />
      </form>
    </div>
  );
};

function Vault() {
  const [site, setSite] = useState("");
  const [password, setPassword] = useState("");

  const addToFirebase = async () => {
    if (site === null || password === null) return;
    const encryptedPassword = encrypt(
      password,
      await retrieveMasterPassword(auth.currentUser.uid)
    );
    const jsonData = {
      password: encryptedPassword,
      site: site,
    };
    setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        jsonArrayField: arrayUnion(jsonData),
      },
      { merge: true }
    );
  };
  return (
    <div className="vault">
      <button className="add-button" onClick={addToFirebase}>
        Add
      </button>
      <div className="input-row">
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          onChange={(e) => {
            setSite(e.target.value);
          }}
        />
      </div>
      <div className="input-row">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
      </div>
      <PasswordDiv></PasswordDiv>
    </div>
  );
}

function PasswordDiv() {
  const [data, setData] = useState([]);
  const [masterPassword, setMasterPassword] = useState(null);

  useEffect(() => {
    async function fetchMasterPassword() {
      const userMasterPassword = await retrieveMasterPassword(
        auth.currentUser.uid
      );
      setMasterPassword(userMasterPassword);
    }
    fetchMasterPassword();
  }, []);

  useEffect(() => {
    const userId = auth.currentUser.uid;
    const docRef = doc(db, "users", userId);

    const updateData = (docSnap) => {
      if (docSnap.exists()) {
        const jsonData = docSnap.data().jsonArrayField;
        setData(jsonData);
      }
    };
    const unsubscribe = onSnapshot(docRef, updateData);
    return () => {
      unsubscribe();
    };
  }, []);

  const deleteItem = async (siteToDelete) => {
    const userId = auth.currentUser.uid;
    const userRef = doc(db, "users", userId);

    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (userData) {
      const itemIndex = userData.jsonArrayField.findIndex(
        (item) => item.site === siteToDelete
      );

      if (itemIndex !== -1) {
        const newArray = [
          ...userData.jsonArrayField.slice(0, itemIndex),
          ...userData.jsonArrayField.slice(itemIndex + 1),
        ];
        await updateDoc(userRef, {
          jsonArrayField: newArray,
        });
      }
    }
  };

  return (
    <div>
      <h2>Passwords 🔑:</h2>
      <ul>
        {data && Array.isArray(data) && data.length > 0
          ? data.map((item, index) => (
              <div className="component-container" key={index}>
                <p>
                  Site: {item.site} Password:{" "}
                  {decrypt(item.password, masterPassword)}
                </p>
                <button
                  className="delete-button"
                  onClick={() => deleteItem(item.site)}
                >
                  Delete
                </button>
              </div>
            ))
          : null}
      </ul>
    </div>
  );
}

const encrypt = (password, SECRET_KEY) => {
  const encrypted = CryptoJS.AES.encrypt(password, SECRET_KEY).toString();
  return encrypted;
};

const decrypt = (password, SECRET_KEY) => {
  return CryptoJS.AES.decrypt(password, SECRET_KEY).toString(CryptoJS.enc.Utf8);
};

const retrieveMasterPassword = async (userId) => {
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnapshot = await getDoc(userDocRef);

    if (docSnapshot.exists()) {
      const userData = docSnapshot.data();
      const master = userData.master;
      const SECRET_KEY = userData.SECRET;
      const decrypted = CryptoJS.AES.decrypt(master, SECRET_KEY).toString(
        CryptoJS.enc.Utf8
      );
      return decrypted;
    } else {
      console.log("User document does not exist.");
    }
  } catch (error) {
    console.error("Error fetching user document:", error);
  }
};

function generateRandomSecretKey(length) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secretKey = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    secretKey += charset[randomIndex];
  }

  return secretKey;
}

export default App;
