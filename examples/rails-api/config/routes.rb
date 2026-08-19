Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :products do
        member do
          post :restock
        end
      end
      resources :orders, only: [:index, :show, :create]
    end
  end
end
