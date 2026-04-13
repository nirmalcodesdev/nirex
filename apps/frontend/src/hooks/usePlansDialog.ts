import { useLocation, useNavigate } from "react-router-dom";

export function usePlansDialog() {
  const location = useLocation();
  const navigate = useNavigate();

  const openPlansDialog = () => {
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: "#plans",
      },
      { replace: false },
    );
  };

  const closePlansDialog = () => {
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: "",
      },
      { replace: false },
    );
  };

  return {
    isPlansDialogOpen: location.hash === "#plans",
    openPlansDialog,
    closePlansDialog,
  };
}
