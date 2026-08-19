Rails.application.routes.draw do
  root "articles#index"

  resources :users do
    resources :articles, only: [:index, :show]
  end

  resources :articles do
    resources :comments, only: [:create, :destroy]
    member do
      post :publish
      post :archive
    end
  end

  namespace :admin do
    resources :dashboard, only: [:index]
    resources :users
  end
end
