import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const useFetchData = (apiFunction, immediate = true) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      let formattedError = {
        message: "Une erreur inattendue est survenue.",
        status: null,
        details: null,
        validationErrors: null
      };
      if (axios.isAxiosError(err)) {
        if (err.response) {
          const responseData = err.response.data;
          formattedError.status = err.response.status;
          formattedError.details = responseData;
          if (responseData?.detail) {
            if (Array.isArray(responseData.detail)) {
              formattedError.message = "Certaines données envoyées sont invalides.";
              formattedError.validationErrors = responseData.detail.map(errItem => ({
                field: errItem.loc.join('.'),
                message: errItem.msg,
                type: errItem.type
              }));
            } else if (typeof responseData.detail === 'string') {
              formattedError.message = responseData.detail;
            }
          } else {
            formattedError.message = responseData?.message || err.response.statusText || `Erreur ${err.response.status}`;
          }
        } else if (err.request) {
          formattedError.message = "Le serveur FastAPI ne répond pas (vérifiez votre connexion).";
        } else {
          formattedError.message = err.message;
        }
      } else if (err instanceof Error) {
        formattedError.message = err.message;
      }
      setError(formattedError);
    } finally {
      setIsLoading(false);
    }
  }, [apiFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { data, isLoading, error, reload: execute };
};  